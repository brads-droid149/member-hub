# Fix: Stripe webhook missing invoice events

## Confirmed — the problem is real

Checked the database before planning:

- `stripe_webhook_events` contains only `checkout.session.completed` (8), `customer.subscription.created` (8), `customer.subscription.deleted` (5), `customer.subscription.updated` (4). **Zero `invoice.*` rows, ever** (records go back to 30 June).
- `email_send_log` has **zero rows for any receipt template** — signup, recovery and billing-cancelled emails exist, receipts never have.

So receipts, dunning, and past_due -> active reactivation on a successful retry have never fired. The handler code for them is present and correct; the events simply aren't delivered.

## One correction to the proposed approach

There is no `STRIPE_SECRET_KEY` in this project. Payments run through Lovable's connector gateway; the stored secrets are `STRIPE_SANDBOX_API_KEY` / `STRIPE_LIVE_API_KEY`, which are opaque gateway connection identifiers, not Stripe secret keys, and they only exist inside the edge-function runtime. A local one-off script cannot authenticate to Stripe.

Equivalent approach: a temporary edge function that uses the existing `createStripeClient(env)` helper (same gateway path all other Stripe calls use), invoked once per environment, then deleted.

## Part A — subscribe the existing endpoints to invoice events

Temporary function `supabase/functions/admin-fix-webhook-events/index.ts`:

- Admin-only (verify caller JWT has the `admin` role), takes `{ env: "sandbox" | "live" }`.
- `stripe.webhookEndpoints.list()`, filter to endpoints whose `url` contains `payments-webhook`. The `api.lovable.dev/.../payments-webhook/<env>` analytics endpoint is Lovable-managed and must be left alone — only the Supabase functions endpoint is touched.
- For each match: read `enabled_events`, union in `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`, update via `stripe.webhookEndpoints.update(id, { enabled_events })`. Never removes an existing event, never creates an endpoint.
- Returns before/after `enabled_events` per endpoint so the change is logged. If no matching endpoint exists, it reports that and changes nothing.

Run sandbox first, verify, then live. Delete the function afterwards.

## Part B — safety net receipt on checkout.session.completed

In `supabase/functions/payments-webhook/index.ts`, add a `checkout.session.completed` case:

- Only for `mode === "subscription"` and only when `payment_status !== "unpaid"`.
- Resolve `userId` from session metadata / subscription metadata.
- Before sending, query `email_send_log` for an existing `receipt` row tied to this subscription; skip if present. `handleInvoicePaid` gets the same guard, so whichever event lands first wins and the other is a no-op.
- Receipt fields mirror `handleInvoicePaid`: `amount_total`/100 + `currency` for the amount, session `created` for the date, line-item `period.end` for next billing date. No invoice number/URL is available on the session, so those stay undefined.

This covers only the first receipt. Renewal receipts, dunning, and reactivation-on-retry still depend on Part A.

## Verification

1. Fresh test-mode checkout -> `email_send_log` shows a `receipt` row reaching `sent`.
2. `stripe_webhook_events` shows an `invoice.paid` or `invoice.payment_succeeded` row for that checkout (proves Part A landed).
3. Confirm exactly one receipt for that subscription (dedup guard works).
4. If a decline can be forced on a renewal: `invoice.payment_failed` appears and a dunning email is logged.

## Technical notes

- Receipt idempotency uses the existing `idempotencyKey` on `sendBillingEmail` plus the `email_send_log` lookup.
- The event-id dedup in `handleWebhook` already prevents double-processing of the same Stripe event; the new guard covers two *different* events describing the same payment.
