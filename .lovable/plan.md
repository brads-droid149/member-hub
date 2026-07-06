## Plan: Pass Tolt referral ID to Stripe checkout metadata

Threads `window.tolt_referral` from the browser through the create-checkout edge function into Stripe session + subscription metadata, so Tolt can attribute paid conversions to referrers.

### 1. `src/components/StripeEmbeddedCheckout.tsx`

- Add a `declare global` block at the top typing `window.tolt_referral?: string` (mirrors the pattern used in `Signup.tsx`).
- In `fetchClientSecret`, extend the body passed to `supabase.functions.invoke("create-checkout", ...)` with:
  ```ts
  toltReferral: typeof window !== "undefined" ? window.tolt_referral : undefined,
  ```

### 2. `supabase/functions/create-checkout/index.ts`

- Add `toltReferral?: string;` to the `options` parameter type of `createCheckoutSession`.
- In `stripe.checkout.sessions.create({...})`, replace the session-level metadata spread:
  ```ts
  ...(options.userId && { metadata: { userId: options.userId } }),
  ```
  with:
  ```ts
  ...((options.userId || options.toltReferral) && {
    metadata: {
      ...(options.userId && { userId: options.userId }),
      ...(options.toltReferral && { tolt_referral: options.toltReferral }),
    },
  }),
  ```
- Apply the same replacement inside `subscription_data.metadata` (recurring branch) so the referral lands on the Subscription too — so it flows onto every renewal invoice, not just the first checkout session.
- In `handler`, when calling `createCheckoutSession(...)`, add:
  ```ts
  toltReferral: typeof body.toltReferral === "string" ? body.toltReferral : undefined,
  ```
  Type-guarding on `string` ensures a non-string client payload is safely ignored rather than crashing Stripe's metadata validation.

### Non-goals

- No `customer_creation` param (customer already resolved via `resolveOrCreateCustomer` and passed as `customer: customerId`; also invalid for subscription mode).
- No changes to GST tax rate logic, price resolution, `automatic_tax`, `ui_mode`, `resolveOrCreateCustomer`, or existing `userId` metadata behavior — `tolt_referral` is added alongside.
