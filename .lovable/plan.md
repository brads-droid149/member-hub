# Free Browsing + Paywalled Perks

Change the gating model from "pay before you see anything" to "sign up free, browse the portal, pay to unlock discount codes and giveaway entries." The lock is enforced in the database, not just the UI.

## 1. Database access rules (one migration)

- Giveaways: any signed-in user can view. Writes stay admin-only.
- Past winners: any signed-in user can view. Writes stay admin-only.
- Banners: relax the SELECT policy so any signed-in user can view active banners (keep `is_active = true`, drop the subscription check). Writes stay admin-only.
- Partners table: unchanged — only active/past_due members and admins can read a full row (the only place `discount_code` lives).
- New partner preview exposing only id, name, logo, description, website — no discount code:
  - `public.get_partners_preview()` as SECURITY DEFINER with `SET search_path = public`, hard-selecting the five safe columns. `discount_code` is never referenced in the body.
  - Thin view `public.partners_preview` over that function for a table-like client call.
  - `REVOKE ALL` from `PUBLIC` on both (Postgres grants to PUBLIC by default, which includes `anon`), then grant EXECUTE / SELECT to `authenticated` only.

## 2. Signup

- No-confirmation signups: `navigate("/subscribe")` becomes `navigate("/")`.
- Confirmation signups: `emailRedirectTo` changes from `${origin}/subscribe` to `${origin}/` so confirmed users land on the portal.
- `/check-email` keeps its structure; its copy changes from "Once confirmed, sign in to choose your membership." to "Once confirmed, sign in to start exploring the club."

## 3. Route protection

`ProtectedRoute` no longer bounces signed-in users without a membership to `/subscribe`. Only signed-out users are redirected (to `/login`). Admin-only routes keep their current behaviour.

New `unverified` state, checked right after the `no-session` check and before the admin/membership checks, on both `/` and admin-only routes: if a session exists but `email_confirmed_at` is missing, redirect to `/check-email`.

Confirmed: a member whose subscription lapses or is cancelled now soft-downgrades into the free-browsing view (locked codes, locked entries, "Join the Club" reappears) rather than being redirected.

## 4. Membership state

`useHomeData` also fetches the caller's admin role via the existing `has_role` RPC pattern, in parallel with the profile/members/subscriptions reads. `isMember` is true when a membership row exists with status `active` or `past_due` (which already covers billing-exempt accounts, seeded as `active`), or when the user holds the admin role. `Home` passes `isMember` to each section and to `AppSidebar`.


## 5. Partner discounts section

- Member: unchanged — real codes, click to copy.
- Free user: loads `partners_preview`; each card shows an "Unlock with membership" lock pill instead of a code, and clicking the card or pill goes to `/subscribe?intent=discount&partner=<name>`. Intro line becomes "Join the club to unlock these codes."

## 6. Overview section

- Giveaway card, Past Winners card, and both banners render for everyone.
- "Your Entries This Draw" for a free user shows a locked state — lock icon, "Join to start earning entries," and a Join button to `/subscribe?intent=entries` — visually distinct from a member on zero entries.

## 7. Sidebar

`AppSidebar` takes an `isMember` prop. When `isMember` is false and the user is not an admin, a primary/filled "Join the Club" item (Trophy icon) renders at the top of the nav list, above Overview, navigating to `/subscribe?intent=nav`. It renders nothing for members and admins, and disappears automatically once membership activates (Subscribe already redirects on the realtime member-row change).

## 8. Subscribe page

- "Back to portal" link near the top of the plan-selection view only (not needs-verify or checkout), shown only in the free-browsing flow, navigating to `/`.
- Intent-aware headline from `?intent=`:
  - `discount`: "Unlock {partner} — join the club" (fallback "Unlock partner discounts")
  - `entries`: "Start earning giveaway entries"
  - `nav` / none: existing "Choose your membership"
  Perks list unchanged.
- Plan pre-selection: any intent param other than `nav` defaults the toggle to yearly; direct nav with no intent keeps monthly.

## 9. Analytics

The codebase has no existing GTM/dataLayer helper, so add a small one (e.g. `src/lib/analytics.ts`) that safely pushes to `window.dataLayer`. Each paywall CTA pushes `{ event: "paywall_click", location: "partner_card" | "entries_card" | "sidebar" }` before navigating.

## Untouched

Stripe checkout, Tolt tracking, pricing/vouchers, `create-checkout`, and `payments-webhook` are not changed.

## Verification

1. Free signup (no confirmation) lands on the portal.
2. Free signup requiring confirmation lands on the portal after clicking the email link.
3. `partners_preview` network payload contains no `discount_code`.
4. Direct `partners` query from a free account returns zero rows.
5. Promo and future-giveaway banners render for a free account.
6. Active member: real codes, copy works, real entry count, no "Join the Club".
7. Admin: full access, no "Join the Club".
8. Each of the three CTAs produces the right Subscribe headline and pre-selected plan; "Back to portal" returns to `/`.
9. Test-mode checkout from a free account removes the sidebar button without a manual refresh.
10. Cancelling a test-mode subscription leaves the user in the portal, reverted to the free-browsing view.
