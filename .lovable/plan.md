# Plan: live-test dunning + reactivation-on-retry (test mode)

Investigation only so far — nothing has been executed.

## What I confirmed first

- Handlers are in place: `handleInvoicePaymentFailed` (sets `past_due`, stamps `past_due_since`, sends dunning only when `past_due_since` was null, with a real Billing Portal link and a dashboard-URL fallback) and `handleInvoicePaid` (sets `status='active'`, `past_due_since=null` for `subscription_cycle` / `subscription_create` / `subscription_update`).
- `stripe_webhook_events` shows `invoice.paid` and `invoice.payment_succeeded` have now been delivered (first ones on 4 Aug). **`invoice.payment_failed` has never been received** — so the failure half of the flow is completely unproven in production.
- Cron: `credit-monthly-entries-daily` (00:15 UTC) and `process-stale-past-due-daily` (00:30 UTC). Stale handling only cancels after 7 days in `past_due`, so a same-day test cannot be contaminated by it — but the test should still be closed out well inside 7 days.
- Test-mode data: one usable sandbox member — `connect@junkyardsurf.com.au`, monthly sub `sub_1U0fyI...`, currently `active`, period end 4 Sep 2026. There is exactly one live member and it must not be touched.

## Approach recommendation

Ranked by confidence and by fit with how this project actually creates subscriptions.

### Option A (preferred) — Stripe test clock, fresh sandbox subscription

A renewal decline cannot be forced on the existing sandbox subscription: test clocks only apply to customers created **on** a clock, and the existing sandbox customer was created by the normal checkout flow. So this needs a purpose-built throwaway.

Steps (all in test mode, all via the connector gateway using the existing `createStripeClient('sandbox')`):

1. Create a throwaway auth user (e.g. `dunning-test+<date>@junkyardsurf.com.au`) so there is a real `userId` for the member row and emails.
2. Create a test clock set to now; create a customer **on that clock** with `metadata.userId` set to the throwaway user.
3. Attach test PM `pm_card_visa` (succeeds), create a subscription on `membership_monthly`. This produces `customer.subscription.created` + `invoice.paid` (subscription_create) → member row created `active`, first receipt sent.
4. Swap the default payment method to a card that declines on charge (`4000 0000 0000 0341` / `pm_card_chargeCustomerFail`).
5. Advance the clock past the renewal date → renewal invoice charges and fails → `invoice.payment_failed`.
6. Swap back to `pm_card_visa`, then pay the open invoice (or advance the clock to the next retry) → `invoice.paid` with `billing_reason=subscription_cycle`.
7. Tear down: delete the throwaway user + member row, cancel the sub, delete the test clock.

This needs a temporary admin-only edge function (same pattern as the earlier `admin-fix-webhook-events` approach) because Stripe credentials only exist inside the edge runtime — there is no `STRIPE_SECRET_KEY` available locally.

Risk: if test clocks are not enabled for this account/mode, step 2 fails immediately and harmlessly — we find out before anything is created.

### Option B — decline the next real renewal on the existing sandbox sub

Change the sandbox customer's default card to the declining card and wait for 4 Sep. Zero tooling, but a month of latency. Not recommended as the primary path; usable as a passive backstop.

### Option C (fallback, lower confidence) — replay the two webhook events by hand

Post synthetic, correctly-signed `invoice.payment_failed` then `invoice.paid` payloads to `payments-webhook?env=sandbox` against the existing sandbox member.

This proves the handler logic, the email path, the portal-link generation and the DB transitions. It does **not** prove that Stripe actually delivers `invoice.payment_failed` to this endpoint — which, given that event has never once been seen, is the single biggest open question. I'd only use this if Option A is blocked, and would report it as a partial pass.

## Pass/fail checks

After the simulated decline:
- `members.status = 'past_due'` and `past_due_since` non-null for the test user.
- Exactly **one** `billing-dunning` row in `email_send_log` for that recipient (dedupe by `message_id`), reaching `sent`.
- `stripe_webhook_events` contains an `invoice.payment_failed` row (Option A only — this is the proof the endpoint is subscribed).
- The dunning email's CTA is a `billing.stripe.com/...` session URL, **not** `https://members.junkyardsurf.com.au/`. The fallback URL means portal creation failed and the test fails on this point even if everything else passes. Also check the edge logs for `dunning portal session create failed`.

After the successful retry:
- `members.status = 'active'`, `past_due_since IS NULL`.
- `stripe_webhook_events` has an `invoice.paid` / `invoice.payment_succeeded` row timestamped between the decline and the status flip — this is what proves reactivation came from the invoice event and not from a cron run. Cross-check that `process-stale-past-due-daily`'s 00:30 UTC run did not fall in the window, and that no `billing-cancelled-*` row exists in `email_send_log` for that user.
- A `billing-receipt` row for the renewal, exactly one.

## Constraints and unknowns

- Test-clock availability on this Stripe account is unverified; Option A step 2 is the probe.
- Any Option A / C run creates real rows in `email_send_log` and (Option A) a real auth user — both are cleaned up in teardown.
- Nothing in this plan touches the live environment or the single live member.

## Next step

Confirm which option to run. If Option A, I'll write the temporary admin-only edge function, probe test-clock availability first, and stop for confirmation before creating the subscription.
