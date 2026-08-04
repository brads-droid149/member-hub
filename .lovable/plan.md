# Free accounts browse the portal, membership unlocks codes + entries

Shift from "pay before you see anything" to "sign up free, look around, pay to unlock discount codes and giveaway entries." The lock is enforced in the database, not just in the interface.

## Database access rules (new migration)

- **Giveaways**: any signed-in user can view (admin bypass kept). Writes stay admin-only.
- **Past winners**: any signed-in user can view. Writes stay admin-only.
- **Partners**: the base table keeps its current rule — only active/past_due members and admins can read a full partner row, which is the only place `discount_code` lives.
- **Partner preview**: a new read-only source exposing only id, name, logo, description and website — no discount code at all — readable by any signed-in user.

Important detail: on this database (Postgres 17), a plain "invoker" view would inherit the partners table rule and return nothing for free users. So the preview is exposed as a `SECURITY DEFINER` function `public.get_partners_preview()` that hard-selects the five safe columns, with `EXECUTE` granted to authenticated only, plus a thin view `public.partners_preview` over that function for a table-like client call. `discount_code` is never referenced in the function body, so it cannot leak even by mistake.

## Signup

New signups that don't need email confirmation land on the portal (`/`) instead of the subscribe page. The email-confirmation path (`/check-email`) is unchanged.

## Route protection

A signed-in user without a membership is let into the portal instead of being bounced to `/subscribe`. Only signed-out users are redirected (to `/login`). Admin-only routes keep their existing behaviour.

## Membership state for the interface

`useHomeData` exposes an `isMember` flag (true when a membership row exists with status active or past_due; admins and billing-exempt accounts count as members). Home passes it to each section.

## Partner discounts section

- Member: unchanged — real codes, click to copy.
- Free user: loads the preview source, cards show a lock pill reading "Unlock with membership" instead of a code, and clicking the card or pill goes to `/subscribe`. Intro line becomes "Join the club to unlock these codes."

## Overview section

- Giveaway card and Past Winners card now render for everyone.
- "Your Entries This Draw" for a free user shows a locked state — lock icon, "Join to start earning entries," and a Join button to `/subscribe` — clearly different from a member sitting on zero entries.

## Sidebar

Free users get a persistent "Upgrade" call-to-action in the sidebar footer linking to `/subscribe`. Hidden for members and admins.

## Technical notes

- Migration adds: relaxed SELECT policies on `giveaways` and `past_winners` (`TO authenticated`), `public.get_partners_preview()` (SECURITY DEFINER, `SET search_path = public`, EXECUTE to authenticated), and `public.partners_preview` view with SELECT granted to authenticated.
- `ProtectedRoute` keeps computing membership but only redirects on `no-session` / `not-admin`; the `no-membership` verdict becomes `allowed`.
- `PartnersSection` gets an `isMember` prop and branches its query and card rendering; the partner type for free users omits `discount_code`.
- Untouched: Stripe checkout, Tolt tracking, `create-checkout`, `payments-webhook`.

## Verification pass

1. New free account lands on the portal, not `/subscribe`.
2. Network payload for the preview query contains no `discount_code` field.
3. A direct `partners` query from that free account's console returns zero rows (server-side block confirmed).
4. Existing active member: codes visible, copy works, real entry count.
5. Admin: sees everything regardless of membership.
