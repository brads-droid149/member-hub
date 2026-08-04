# Execute Option A: dunning + reactivation-on-retry (sandbox only)

Two things to settle before I run anything — see "Blockers" at the bottom. Everything else is ready.

## Baseline (already captured, unchanged)

- Existing sandbox member `connect@junkyardsurf.com.au` — monthly sub `sub_1U0fyI...`, subscription `active`, member `active`, `past_due_since` null, period end 4 Sep 2026. Recorded now as the "before" half of the sanity bookend; nothing in this test reads or writes it.
- One live member exists and is never touched. All work is `env=sandbox`.
- `stripe_webhook_events` has never contained an `invoice.payment_failed` row. Step 6 is the real experiment.
- Crons: `credit-monthly-entries-daily` 00:15 UTC, `process-stale-past-due-daily` 00:30 UTC (only cancels after 7 days in `past_due`, so it cannot interfere within a same-day run).

## Execution

All Stripe calls run inside a temporary admin-only edge function `admin-dunning-test` (Stripe credentials only exist in the edge runtime). It takes an `action` parameter so each step is a separate, confirmable invocation, and it hard-refuses any `env` other than `sandbox`.

1. `probe` — create and immediately delete a test clock. If the account rejects test clocks, stop and report; no fallback without your go-ahead.
2. `setup-user` — create auth user `connect+dunningtest@junkyardsurf.com.au`, email pre-confirmed. Record the uid.
3. `setup-stripe` — test clock at now; customer created on the clock with `metadata.userId` = that uid; attach `pm_card_visa` as default.
4. `subscribe` — subscription on `membership_monthly` (AUD, same GST tax-rate path as `create-checkout`). Expect `customer.subscription.created` + `invoice.paid` (`subscription_create`), member row created `active`, first receipt enqueued. **Pause here for your inbox confirmation.**
5. `set-bad-card` — swap default PM to `pm_card_chargeCustomerFail`.
6. `advance` — advance the clock past the renewal date. **Key checkpoint:** an `invoice.payment_failed` row must appear in `stripe_webhook_events`.
7. Decline checks: `members.status='past_due'`, `past_due_since` non-null, exactly one `billing-dunning` message in `email_send_log` reaching `sent`, and the portal URL in the sent email is a `billing.stripe.com` session — not the `members.junkyardsurf.com.au` fallback. I'll also grep the edge logs for `dunning portal session create failed`. **Pause for your inbox confirmation.**
8. `set-good-card` + pay the open invoice (or advance to the next retry) → `invoice.paid`, `billing_reason=subscription_cycle`.
9. Retry checks: `members.status='active'`, `past_due_since IS NULL`, an `invoice.paid`/`invoice.payment_succeeded` row timestamped between the decline and the flip (this is what proves it was the invoice event, not a cron), no `billing-cancelled-*` row for that user, exactly one renewal `billing-receipt`. **Pause for your inbox confirmation.**
10. `teardown` — cancel the sub, delete the test clock and customer, delete the throwaway auth user and its member/profile/subscription rows, remove the temporary edge function. Re-read the `connect@` member + subscription and diff against the baseline above.

## Blockers — need your answer before step 1

**1. I cannot open the inbox.** I have no read access to `connect@junkyardsurf.com.au`. Steps 4, 7 and 9 ask me to physically open the emails, confirm rendering, and click the portal link — I can't do any of that. What I *can* prove from my side: the row in `email_send_log` reaches `sent`, the provider accepted it, and the exact HTML/text body plus the literal portal URL that was rendered (I can print both, so you can eyeball the copy and paste the link yourself without opening the mailbox). The physical-arrival and click-through checks have to be you, at each of the three pause points. Confirm you're happy to be the one checking, or tell me another way in.

**2. Plus-alias deliverability is unverified.** Whether `connect+dunningtest@` lands in the `connect@` inbox depends on the mail host for junkyardsurf.com.au, and I can't confirm that without sending to it. Options: (a) you confirm the host supports `+` aliasing and I proceed; (b) you give me a different real address you control; (c) I send a throwaway first email to the alias and we check before building the Stripe side. I'd rather not guess.

Answer those two and I'll start at the probe.
