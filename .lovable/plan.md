# Switch from `automatic_tax` to a fixed AU GST `tax_rate`

## Scope
One file only. No DB changes. No frontend changes. Sandbox and live Stripe environments both handled (the resolver runs per-env).

**File:** `supabase/functions/create-checkout/index.ts`

## Exact changes

### 1. New helper `resolveOrCreateAuGstTaxRate` (added above `createCheckoutSession`, ~line 36)

Resolves a reusable 10% inclusive GST `tax_rate` per Stripe env, cached in module scope so we only hit Stripe once per cold start.

```ts
// Cached per Stripe env — tax_rate objects have no lookup_key, so we list+match.
const _auGstTaxRateCache: Partial<Record<StripeEnv, string>> = {};

async function resolveOrCreateAuGstTaxRate(
  stripe: ReturnType<typeof createStripeClient>,
  env: StripeEnv,
): Promise<string> {
  if (_auGstTaxRateCache[env]) return _auGstTaxRateCache[env]!;

  // List active rates and match on our canonical shape. Stripe caps at 100
  // active rates per account, which is fine — we only ever create one.
  const existing = await stripe.taxRates.list({ active: true, limit: 100 });
  const match = existing.data.find(
    (r) =>
      r.active &&
      r.inclusive === true &&
      Number(r.percentage) === 10 &&
      r.country === "AU" &&
      (r.display_name === "GST" || r.jurisdiction === "AU"),
  );
  if (match) {
    _auGstTaxRateCache[env] = match.id;
    return match.id;
  }

  const created = await stripe.taxRates.create({
    display_name: "GST",
    description: "Australian GST",
    jurisdiction: "AU",
    country: "AU",
    percentage: 10,
    inclusive: true,
    active: true,
  });
  _auGstTaxRateCache[env] = created.id;
  return created.id;
}
```

### 2. Update `stripe.checkout.sessions.create` call (currently lines ~94–104)

Current:
```ts
const session = await stripe.checkout.sessions.create({
  line_items: [{ price: stripePrice.id, quantity: options.quantity || 1 }],
  mode: isRecurring ? "subscription" : "payment",
  ui_mode: "embedded_page",
  return_url: options.returnUrl,
  automatic_tax: { enabled: true },
  ...(customerId && { customer: customerId }),
  ...(options.userId && {
    metadata: { userId: options.userId },
    ...(isRecurring && { subscription_data: { metadata: { userId: options.userId } } }),
  }),
} as any);
```

New:
```ts
const auGstTaxRateId = await resolveOrCreateAuGstTaxRate(stripe, options.environment);

const session = await stripe.checkout.sessions.create({
  line_items: [{
    price: stripePrice.id,
    quantity: options.quantity || 1,
    // One-off charges take tax_rates on the line item.
    ...(!isRecurring && { tax_rates: [auGstTaxRateId] }),
  }],
  mode: isRecurring ? "subscription" : "payment",
  ui_mode: "embedded_page",
  return_url: options.returnUrl,
  // Explicitly disabled — we attach a fixed AU GST tax_rate instead so
  // Stripe doesn't charge the automatic_tax per-transaction fee.
  automatic_tax: { enabled: false },
  ...(customerId && { customer: customerId }),
  ...(isRecurring && {
    // For subscriptions, tax rates must be attached via subscription_data
    // (they flow onto every renewal invoice automatically).
    subscription_data: {
      default_tax_rates: [auGstTaxRateId],
      ...(options.userId && { metadata: { userId: options.userId } }),
    },
  }),
  ...(options.userId && !isRecurring && {
    metadata: { userId: options.userId },
  }),
  ...(options.userId && isRecurring && {
    metadata: { userId: options.userId },
  }),
} as any);
```

(The two trailing `metadata` spreads collapse to one — kept split above for diff clarity; final code will just be a single `...(options.userId && { metadata: { userId: options.userId } })` at the top level, with `subscription_data` carrying its own metadata.)

## Behaviour after change

- Monthly (A$5) and yearly (A$55) both continue to display "includes GST" at Stripe Checkout — price is unchanged because `inclusive: true` matches the existing Price `tax_behavior: inclusive`.
- Renewal invoices inherit `default_tax_rates` from the Subscription — no per-invoice work needed.
- No Stripe Tax fee (+0.5%) applied going forward.
- Existing active subscriptions are **not** retroactively modified — they continue on whatever tax config they were created with. Only new checkouts use the fixed tax_rate.

## Risks / notes to confirm

1. **Existing subscriptions**: this change only affects new checkouts. If you want existing active subs migrated onto the fixed tax_rate too, that's a separate one-off script (`stripe.subscriptions.update(id, { default_tax_rates: [id] })` per active sub) — say the word and I'll add it.
2. **Sandbox vs live tax_rate objects**: the resolver runs per-env, so a `txr_...` gets created in sandbox on first sandbox checkout and separately in live on first live checkout. Both are fine and cached.
3. Nothing in `payments-webhook`, `create-portal-session`, or the members-sync path reads tax fields, so no downstream code needs updating.
