# Architecture

This document captures the two non-obvious state machines that drive the
Junkyard Surf Club portal: **billing/access** and **outbound email**. Both
are currently described only in inline comments across `supabase/functions/`
and `src/components/ProtectedRoute.tsx` — this file is the single canonical
source.

---

## 1. Billing & Access State Machine

Three Postgres tables collaborate; each is owned by a different writer.

| Table              | Writer                                          | Role                                                    |
| ------------------ | ----------------------------------------------- | ------------------------------------------------------- |
| `subscriptions`    | `payments-webhook` (Stripe events)              | Mirror of Stripe truth, one row per Stripe subscription |
| `members`          | `payments-webhook`, `process-stale-past-due`, admin tools | App-facing membership: status + entries + grace timers |
| `auth.users`       | Supabase Auth                                   | Identity                                                |

### 1.1 Stripe status → `members.status`

`payments-webhook` collapses Stripe's ~8 subscription statuses down to **3
app-level states** via `mapMemberStatus()` (see
`supabase/functions/payments-webhook/index.ts`):

| Stripe status                                  | `members.status` | Notes                                                                                       |
| ---------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| `active`, `trialing`, `incomplete`             | `active`         | `incomplete` (e.g. 3DS pending) grants access; if it expires Stripe sends `incomplete_expired`. |
| `past_due`                                     | `past_due`       | Keeps access. Stamps `past_due_since`. Daily cron auto-cancels at 7 days.                   |
| `canceled`, `unpaid`, `incomplete_expired`, `paused` | `cancelled`  | Access revoked, `entries` reset to 0.                                                       |
| anything else (defensive)                      | `past_due`      | Logged + retained access so an unknown status never 400s the webhook.                       |

### 1.2 Transitions

```text
                  Stripe subscription event              invoice.paid (cycle)
                  ───────────────────────►               ───────────────────►
                  syncMember()                           handleInvoicePaid()

       ┌──────────┐                  ┌──────────┐                ┌──────────┐
       │  (none)  │ ── checkout ───► │  active  │ ── renewal ──► │  active  │
       └──────────┘                  └────┬─────┘                └──────────┘
                                          │
                  invoice.payment_failed  │ first failure stamps past_due_since
                                          ▼
                                     ┌──────────┐
                                     │ past_due │ ── invoice.paid ──► active
                                     └────┬─────┘   (clears past_due_since)
                                          │
                       7 days elapsed     │ process-stale-past-due (daily cron)
                                          ▼
                                     ┌───────────┐
                                     │ cancelled │  entries = 0
                                     └───────────┘
                                          ▲
                                          │ customer.subscription.deleted,
                                          │ admin-cancel-member,
                                          │ delete-account
```

Key invariants:

- **Reactivation** (`cancelled → active`): `syncMember()` resets
  `months_active = 1`, `entries = 1`, and re-anchors
  `last_entry_credited_at = now()` so the monthly credit cron restarts on
  today's anchor instead of crediting back-pay.
- **`past_due_since`** is stamped only on the **first** failed invoice of a
  cycle and cleared on any non-`past_due` transition. The `dunning` email is
  also only sent on the first failure — Stripe's retry storm doesn't spam
  the member.
- **Cancellation** always resets `entries = 0`. This is enforced in both the
  webhook path and `process-stale-past-due`.
- **`subscriptions.environment`** (`sandbox` | `live`) coexists in one
  table. **Every read must filter on environment** or sandbox rows leak
  into production reads after publish.

### 1.3 Access gating (`ProtectedRoute.tsx`)

The client gate evaluates two independent checks because they require
different redirects:

```text
                ┌─────────────┐
                │  session?   │── no ──► /login
                └──────┬──────┘
                       │ yes
                ┌──────▼──────┐
                │  is admin?  │── yes ──► allowed (admins bypass membership)
                └──────┬──────┘
                       │ no
                ┌──────▼──────┐
                │ adminOnly?  │── yes ──► / (home)
                └──────┬──────┘
                       │ no
                ┌──────▼─────────────────┐
                │ members.billing_exempt?│── yes ──► allowed (comped/staff)
                └──────┬─────────────────┘
                       │ no
                ┌──────▼─────────────────┐
                │ status in              │
                │ ('active','past_due')? │── yes ──► allowed
                └──────┬─────────────────┘
                       │ no
                       ▼
                   /subscribe
```

`past_due` keeps access on purpose — the home page surfaces a dunning
banner instead. Revocation happens only when the daily cron flips the
member to `cancelled`.

### 1.4 Periodic jobs

| pg_cron job                       | Frequency | What it does                                                              |
| --------------------------------- | --------- | ------------------------------------------------------------------------- |
| `credit_monthly_entries`          | hourly    | `entries += 1`, `months_active += 1` for `active` members whose anchor is ≥1 month old. |
| `process-stale-past-due-daily`    | daily     | Invokes `process-stale-past-due` Edge Function with the service-role key from `vault.decrypted_secrets`. Cancels members past_due >7 days, syncs `subscriptions`, emails them, marks them in Brevo. |
| `process-email-queue` (every 5s)  | 5s        | Drains the email queues (see §2).                                         |

---

## 2. Email Queue Flow

All outbound mail goes through PGMQ. Producers never call the email provider
inline — they enqueue a payload and `process-email-queue` drains it.

### 2.1 Why a queue

- The provider can 429/5xx; auth flows and Stripe webhooks must not block on it.
- Visibility-timeout semantics give us crash-safe at-least-once delivery: a
  claimed message is hidden for `vt` seconds and re-appears if the worker
  dies mid-send.
- PGMQ lives in the existing Postgres — no extra infra, and `read_ct` + DLQ
  tables come for free.

### 2.2 Producers

| Producer                                | Queue                  | Examples                                                  |
| --------------------------------------- | ---------------------- | --------------------------------------------------------- |
| `auth-email-hook` (Supabase Auth hook)  | `auth_emails`          | Signup confirmation, password reset, magic link, email change |
| `_shared/billing-emails.ts → sendBillingEmail()` | `transactional_emails` | Receipt (renewal), dunning (first failure), cancellation  |
| `send-transactional-email` (generic)    | `transactional_emails` | Any app-triggered template                                |

Producers call the `enqueue_email(queue_name, payload)` SECURITY DEFINER RPC
which wraps `pgmq.send`.

### 2.3 Worker — `process-email-queue`

```text
   pg_cron (every 5s)
          │
          ▼
   ┌─────────────────────────┐
   │ process-email-queue     │
   │  (Edge Function)        │
   └──────────┬──────────────┘
              │ read_email_batch(queue, batch_size, vt=30s)
              │ — auth_emails first, then transactional_emails
              ▼
   ┌─────────────────────────┐         ┌────────────────────────┐
   │ for each message:       │         │ suppressed_emails check │
   │   1. TTL expired? ─yes─► DLQ      │ skip + log if matched   │
   │   2. recipient on       │◄────────┴────────────────────────┘
   │      suppression list?  │
   │   3. sendLovableEmail() │
   └──────────┬──────────────┘
              │
      ┌───────┴────────────────────────────────┐
      │                                        │
   success                                  failure
      │                                        │
      ▼                                        ▼
   delete from queue,                ┌────────────────────────┐
   insert email_send_log             │ classify error         │
   (status='sent')                   │  - 429: stop batch,    │
                                     │    honour Retry-After  │
                                     │  - 403: → DLQ now      │
                                     │  - other 5xx: leave    │
                                     │    for vt retry        │
                                     │  - read_ct ≥ 5: → DLQ  │
                                     └────────────────────────┘
```

Defaults (overridable per row in `email_send_state`):

- `MAX_RETRIES = 5`
- `DEFAULT_BATCH_SIZE = 10`
- `DEFAULT_SEND_DELAY_MS = 200` (≈120 emails/min)
- Auth TTL = 15 min, transactional TTL = 60 min
- Visibility timeout = 30 s

Queue priority: **auth_emails drained first** every tick. A magic link must
not get stuck behind a backlog of receipts.

### 2.4 Tables

| Table                     | Role                                                                |
| ------------------------- | ------------------------------------------------------------------- |
| `email_send_log`          | Append-only history. Dedupe by `message_id` for unique sent counts. |
| `email_send_state`        | Single-row throughput / TTL config.                                 |
| `suppressed_emails`       | Bounces, complaints, unsubscribes. Checked before every send.       |
| `email_unsubscribe_tokens` | One-click unsubscribe token mapping (one per address).              |

### 2.5 DLQ

A message moves to `<queue>_dlq` when:

- TTL has elapsed since enqueue.
- The send returned a non-retryable error (403, recipient suppressed).
- `read_ct` reached `MAX_RETRIES` (5).

DLQ moves are logged in `email_send_log` with `status='dlq'` and the failure
reason. Reprocessing is manual.

### 2.6 Service-role key

`process-email-queue` and `process-stale-past-due` are invoked by pg_cron.
Both pull the service-role JWT from `vault.decrypted_secrets` under the key
`email_queue_service_role_key`. **Do not** hardcode the key into the cron
SQL; re-run `email_domain--setup_email_infra` if the key rotates.

---

## 3. Cross-references

- `supabase/functions/payments-webhook/index.ts` — Stripe → members/subscriptions writer.
- `supabase/functions/process-stale-past-due/index.ts` — 7-day grace expiry cron.
- `supabase/functions/process-email-queue/index.ts` — PGMQ drainer.
- `supabase/functions/auth-email-hook/index.ts` — Supabase Auth → `auth_emails` queue.
- `supabase/functions/_shared/billing-emails.ts` — `transactional_emails` producer for billing events.
- `src/components/ProtectedRoute.tsx` — client access gate.
- `src/hooks/use-home-data.ts` — reads `members` for the dashboard.
