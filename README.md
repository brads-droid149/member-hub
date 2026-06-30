# Junkyard Club — Member Portal

**Junkyard Club** is the paid membership portal for [Junkyard Surf](https://junkyardsurf.com.au), hosted at [members.junkyardsurf.com.au](https://members.junkyardsurf.com.au).

Members pay **$5/month (GST inclusive)** for automatic entry into monthly surfboard giveaways and access to partner discounts.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui, Radix UI primitives |
| Backend | Supabase (Auth, Postgres, Realtime, Storage, Edge Functions) |
| Payments | Stripe (subscriptions, embedded checkout, billing portal, Stripe Tax) |
| Email | Brevo (transactional email), Lovable auth email templates |
| Infrastructure | Cloudflare (DNS), Lovable (hosting & preview) |

## Local Development Setup

### Prerequisites
- Node.js 18+ (or Bun)
- A Supabase project (local or cloud)

### Quick Start

```bash
# Install dependencies
npm ci

# Copy environment variables
cp .env.example .env
# Fill in real values in .env (see Environment Variables below)

# Start the dev server
npm run dev
```

The Vite dev server will start on `http://localhost:5173` (or the next available port).

### Running with Lovable
If you're working inside the Lovable environment, the preview is automatically available. Local changes hot-reload in the preview window.

## Environment Variables

Copy `.env.example` to `.env` and fill in the following values. **Never commit `.env` to git.**

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_PROJECT_ID` | Your Supabase project ID (e.g. `zsnhpkqisxwkfaurwcmu`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anonymous/public API key |
| `VITE_SUPABASE_URL` | Supabase project URL (e.g. `https://<project-ref>.supabase.co`) |
| `VITE_PAYMENTS_CLIENT_TOKEN` | Stripe Publishable Key (`pk_test_*` for sandbox, `pk_live_*` for production) |

> **Note:** The project uses Lovable's built-in Stripe integration. The client token is automatically injected during the Stripe go-live flow. Do not manually set a Stripe secret key.

## Supabase Edge Functions

All server-side logic runs as Deno-based Edge Functions in Supabase.

| Function | Purpose |
|----------|---------|
| `create-checkout` | Creates a Stripe Embedded Checkout session for new subscriptions. Resolves or creates a Stripe Customer, looks up prices by `lookup_key`, and returns a `client_secret`. |
| `create-portal-session` | Creates a Stripe Customer Portal session so members can self-manage payment methods, invoices, and cancellations. Validates the return URL for security. |
| `payments-webhook` | Receives and validates Stripe webhook events (`checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.deleted`, etc.). Activates members on successful payment, deactivates on cancellation, and tracks subscription lifecycle. |
| `process-email-queue` | Polls the PGMQ email queues (`auth_emails`, `transactional_emails`) and sends messages via Brevo SMTP. Handles retries, rate limiting, dead-letter queues, and bounce/complaint tracking. |
| `brevo-sync-contact` | Syncs a member's contact details to Brevo (formerly Sendinblue) for marketing and transactional email lists. Called on signup and profile updates. |
| `admin-cancel-member` | Authenticated admin-only endpoint to cancel a member's Stripe subscription and deactivate their account immediately. |
| `admin-update-member` | Authenticated admin-only endpoint to update member stats (entries, months_active, status) and billing exemption flags. |
| `auth-email-hook` | Custom Supabase Auth email hook. Renders React Email templates (signup, magic link, recovery, etc.) and sends via the Lovable email gateway. |

> **Security:** All payment-related edge functions have `verify_jwt = false` in `supabase/config.toml` to allow anonymous checkout flows and CORS preflight requests. Admin functions validate the `Authorization` header and check the `admin` role.

## Key Database Tables

| Table | Purpose |
|-------|---------|
| `members` | Core member record. Links to `auth.users`, stores Stripe IDs, subscription status (`active`, `paused`, `cancelled`), entry count, months active, and exemption flags (`billing_exempt` for comped/staff access, `draw_exempt` to exclude from giveaway draws). |
| `profiles` | Member profile data (full name, phone, state, avatar). One-to-one with `auth.users`. |
| `subscriptions` | Stripe subscription snapshot. Mirrors key subscription data for fast local queries without calling Stripe. |
| `giveaways` | Active and past surfboard giveaways. Stores title, prize image, draw date, and active flag. |
| `past_winners` | Historical record of giveaway winners. Links to a giveaway and stores winner name and prize title. |
| `partners` | Partner businesses offering discounts to members. Stores name, logo, discount code, and description. |
| `user_roles` | Role-based access control. Stores `admin` or `user` roles per account. Used by `has_role()` security definer function. |
| `email_queue` / `email_send_log` | PGMQ-backed email queue tables plus audit log for send attempts, bounces, complaints, and suppressions. |

All tables have Row Level Security (RLS) enabled. Public tables (giveaways, past_winners, partners) allow anonymous `SELECT`. Member and profile tables restrict access to the owner or admin role.

## Stripe Integration Flow

```
Signup → Embedded Checkout → Webhook → Member Activated
```

1. **Visitor signs up** for an account via Supabase Auth (email/password).
2. **Member clicks "Join"** → frontend calls `create-checkout` edge function.
3. **Edge function** resolves/creates a Stripe Customer, creates a subscription Checkout Session with `ui_mode: "embedded_page"`, and returns the `client_secret`.
4. **Frontend mounts** `<EmbeddedCheckout>` from `@stripe/react-stripe-js` — the payment form appears inline.
5. **On successful payment**, Stripe redirects to the `return_url` with `session_id`.
6. **Stripe sends `checkout.session.completed`** to the `payments-webhook` edge function.
7. **Webhook handler** creates/updates the `members` and `subscriptions` records, sets status to `active`, and triggers a welcome email.
8. **Monthly renewals** fire `invoice.payment_succeeded`, which increments `months_active` and compounds giveaway entries based on the membership rules.

## Email Queue System

The project uses **PGMQ** (Postgres Message Queue) for reliable email delivery:

- **Two queues:** `auth_emails` (high priority) and `transactional_emails` (normal priority).
- **Producer:** Auth hooks and transactional triggers enqueue messages with recipient, template, variables, and scheduled send time.
- **Consumer:** The `process-email-queue` edge function runs as a cron job, polls batches from the queues, and sends via Brevo SMTP.
- **Resilience:** Failed sends retry up to 5 times with exponential backoff. Permanent failures (403 forbidden) move to the dead-letter queue (`*_dlq`).
- **Audit:** Every send attempt is logged to `email_send_log` with status (`pending`, `sent`, `failed`, `bounced`, etc.).

## Admin Panel

Located at **`/admin`**. Access is restricted to users with the `admin` role (checked via `has_role()`).

### Features
- **Giveaway Management** — Create/edit giveaways, upload prize images (4:5 portrait, min 1080×1350px), set draw dates, and activate/deactivate giveaways.
- **Partner Management** — Add/edit partner businesses, upload logos, and manage discount codes.
- **Member Management** — View all members in a sortable/filterable table. Actions include:
  - **Cancel Member** — Immediately cancels Stripe subscription and deactivates account.
  - **Edit Stats** — Manually adjust entries, months active, and status.
  - **Toggle Exemptions** — Mark members as exempt from billing or giveaway draws.
  - **Export** — Download CSV exports of member lists, email lists, and draw entry lists.

## Deployment

**Deployment: Production deploys are manual via Lovable's Publish button only. No GitHub Actions or external CI/CD is configured.**

### Database Migrations
Migrations live in `supabase/migrations/` and are applied in filename (timestamp) order.

```bash
supabase link --project-ref <project-ref>
supabase db push
```

## Known Architectural Notes

> **⚠️ Post-Launch Priority for Appomate**
>
> All Stripe and Brevo API calls currently route through the **Lovable connector gateway** (`connector-gateway.lovable.dev`). This gateway handles API key management and request proxying during the Lovable-hosted phase.
>
> **Before moving off Lovable hosting**, these calls must be refactored to use **direct API calls** to Stripe (`api.stripe.com`) and Brevo (`api.brevo.com`). This is the **top post-launch priority** for Appomate.
>
> Affected edge functions: `create-checkout`, `create-portal-session`, `payments-webhook`, `brevo-sync-contact`, `process-email-queue`.

---

Built with ❤️ for the Junkyard Surf community.
