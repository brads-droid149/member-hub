# Reconnect Stripe Payments

You previously had Lovable's built-in Stripe payments connected and just disconnected it. All the membership checkout, billing portal, webhook, dunning email, and stale-past-due cancellation code is still in the project — it just can't talk to Stripe right now because the Stripe API keys and webhook secrets are gone.

The cleanest path is to re-enable the same **built-in Stripe payments** integration (Lovable-managed, no Stripe account or API key required from you). Your seller country is Australia (AU), which is eligible for full Stripe handling.

## What I'll do

1. **Enable built-in Stripe payments** via `enable_stripe_payments`. This re-provisions:
   - `STRIPE_SANDBOX_API_KEY` / `STRIPE_LIVE_API_KEY`
   - `PAYMENTS_SANDBOX_WEBHOOK_SECRET` / `PAYMENTS_LIVE_WEBHOOK_SECRET`
   - A fresh `VITE_PAYMENTS_CLIENT_TOKEN` (test mode publishable key) for the frontend
   - Test (sandbox) environment immediately; live requires Stripe account claim afterwards

2. **Set up Stripe with full compliance handling** (`managed_payments`). Stripe acts as merchant of record for buyers in ~80 supported countries — handles GST/VAT calculation, collection, filing, remittance, fraud, disputes, and transaction-level customer support. Cost: +3.5% on top of base Stripe fees. You can change this per-transaction or turn it off later.
   - Note: this replaces the current `automatic_tax: { enabled: true }` setup in `create-checkout/index.ts` with `managed_payments: { enabled: true }`.

3. **Recreate the membership products** (since product catalog does not carry over after disconnect):
   - `membership_monthly` — A$5/month recurring
   - `membership_yearly` — A$50/year recurring
   - Both tagged with the correct Stripe tax code for digital memberships
   - Created via `batch_create_product` after the integration is enabled

4. **Verify existing code still works** (no rewrites expected — just a sanity pass):
   - `src/lib/stripe.ts`, `StripeEmbeddedCheckout.tsx`, `Subscribe.tsx` — frontend checkout
   - `supabase/functions/create-checkout`, `create-portal-session`, `payments-webhook`, `admin-cancel-member`, `delete-account`, `process-stale-past-due` — backend
   - Update `create-checkout` to use `managed_payments` instead of `automatic_tax`

5. **Confirm the `process-stale-past-due-daily` cron** still works against the new keys (vault secret `email_queue_service_role_key` is unaffected).

## What I will NOT touch

- Database schema, `members` / `subscriptions` tables, RLS policies — all unchanged
- The Brevo email connector and billing email templates
- pg_cron jobs (only verifying, not modifying)
- Auth flow, user roles, admin dashboard

## What you'll need to do

- **Right after enable**: test sandbox checkout end-to-end using a Stripe test card (4242 4242 4242 4242).
- **Before going live**: claim the Stripe account from the Payments panel and complete Stripe's identity/business verification. Until then live mode will reject real payments.
- **Webhook**: the built-in integration registers webhooks automatically — no manual endpoint configuration in a Stripe dashboard.

## Confirm before I proceed

Re-enabling will replace the empty payment secrets and recreate the two membership products. Existing members in your DB are unaffected, but since their old Stripe customer/subscription IDs point at the disconnected account, **any past_due retry, portal session, or admin cancel for pre-disconnect members will fail** — they'll need to re-subscribe through the new Stripe account to get a working billing record. New signups will work normally.

Approve this plan and I'll run the enable flow.
