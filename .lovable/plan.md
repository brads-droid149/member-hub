# Pre-Live Tasklist

A consolidated list of everything that should be verified or finished before flipping `members.junkyardsurf.com.au` to live traffic. Grouped by area, roughly in the order you'd want to tackle them.

## 1. Payments (Stripe)

- [ ] **Run the Stripe readiness check.** Steps 1–4 of go-live are complete; step 5 (readiness check) is still `not_started`. Open the Payments tab and run it — it validates live products, prices, webhooks and tax codes.
- [ ] **Verify live product catalog matches sandbox** (membership prices, lookup keys, tax codes) after the "copy from sandbox" step.
- [ ] **Confirm `VITE_PAYMENTS_CLIENT_TOKEN` in `.env.production`** is the correct live publishable key (currently `pk_live_51ROWKI…`).
- [ ] **Test a real $1 charge end-to-end** on the live key (signup → embedded checkout → webhook → `members` row → portal access → cancel via Billing Portal).
- [ ] **Confirm webhook endpoints exist on the live account** for `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed` and that the `?env=live` query param is set.

## 2. Backend / Database

- [ ] **Run `security--run_security_scan`** — current scan results are empty. Resolve any critical RLS, GRANT, or exposed-column findings before launch.
- [ ] **Run `supabase--linter`** and address warnings (unprotected tables, function search_path, etc.).
- [ ] **Verify pg_cron jobs are scheduled in prod**: `credit_monthly_entries` (daily) and the past-due auto-cancel job (daily, 7-day threshold).
- [ ] **Resolve the two outstanding items from the prior security/code audit** referenced in memory (`mem://features/pending-audit-items` — the file is listed in the index but missing; recreate or close out items 1 and 3).
- [ ] **Confirm `supabase/seed.sql` is NOT applied to prod** (it only runs on `supabase db reset` locally — sanity-check the deploy pipeline).

## 3. Auth & Email

- [ ] **Verify the sending domain DNS** (SPF, DKIM, DMARC, MX if needed) for the address used by the `auth-email-hook`. No custom email domain is configured for this project yet — either configure one or confirm the workspace default is acceptable for production.
- [ ] **Send one of each auth email** (signup, recovery, magic-link, invite, email-change, reauthentication) on the live project and confirm rendering + deliverability (no spam folder, links resolve to `members.junkyardsurf.com.au`).
- [ ] **Set Supabase Auth Site URL and Redirect URLs** to `https://members.junkyardsurf.com.au` (and any preview URLs you want to keep working).
- [ ] **Confirm anonymous sign-ups are disabled** and email confirmations are enabled.

## 4. Deployment & Hosting

- [ ] **Pick a host in `.github/workflows/deploy.yml`** — Cloudflare Pages / Netlify / Vercel block is still commented out. Uncomment and add the matching secrets.
- [ ] **Add all required GitHub Actions secrets** listed in `README.md` (Vite build vars + `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` / `SUPABASE_PROJECT_REF` + host-specific tokens).
- [ ] **Connect the custom domain** `members.junkyardsurf.com.au` in Lovable (Project Settings → Domains) or at your chosen host, including the `www` variant + primary selection.
- [ ] **Confirm SSL is provisioned** and the apex + www both resolve.
- [ ] **First Lovable publish** so the `.lovable.app` URL exists (prerequisite for custom-domain attachment in Lovable).

## 5. CORS & Edge Functions

- [ ] **Audit CORS allowlists** on every edge function. `brevo-sync-contact` and `create-portal-session` already restrict to `members.junkyardsurf.com.au` + `*.lovable.app`. Apply the same pattern to `create-checkout`, `admin-cancel-member`, `admin-update-member`, `process-email-queue`, and `auth-email-hook` if they currently use `"*"`.
- [ ] **Re-deploy all edge functions** after CORS changes and confirm they appear in the prod project.

## 6. SEO / Metadata / Discoverability

- [ ] **Trigger a fresh SEO scan** (`seo_chat--trigger_scan`) — current findings list is empty, so we don't yet know the prod state.
- [ ] **Verify `public/sitemap.xml` and `public/robots.txt`** reference the production domain, not preview URLs.
- [ ] **Confirm `index.html` Organization / WebSite JSON-LD** uses the production URL and correct social handles.
- [ ] **Add a real OG image** (1200×630) if not already in place, and confirm preview rendering via the LinkedIn/Twitter card validators.

## 7. App-level smoke tests on live

- [ ] Signup → email confirm → checkout → home page shows active membership and 1 entry.
- [ ] Past-due simulation (Stripe test clock if useful) → banner appears → 7-day auto-cancel resets entries to 0.
- [ ] Cancel via Billing Portal → status flips to `cancelled` → entries → 0.
- [ ] Reactivation → months_active and entries reset to 1.
- [ ] Admin: members list loads, exempt toggle works, cancel + update-stats actions work, partner logos lazy-load, past_winners ordering uses the new `idx_past_winners_draw_date` index.
- [ ] Mobile sidebar + responsive layout sanity check.

## 8. Operational

- [ ] **Switch `PaymentTestModeBanner`** is gated on `pk_test_` — verify it disappears in prod (it does, but worth eyeballing).
- [ ] **Set up uptime monitoring** for `members.junkyardsurf.com.au` and for the Stripe webhook endpoint.
- [ ] **Set up error monitoring / log review cadence** for edge functions (Supabase function logs).
- [ ] **Document an incident runbook** for: failed webhook, mass past_due, auth email outage.
- [ ] **Backup verification** — confirm Supabase PITR / daily backups are enabled on the prod project.

---

If you'd like, I can immediately tackle the code-level items in section 5 (CORS audit of the remaining edge functions) and section 6 (trigger SEO scan + verify sitemap domain), since those are the items I can finish without you touching Stripe / DNS / GitHub.