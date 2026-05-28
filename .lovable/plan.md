# Rename portal to "Junkyard Surf Club"

The brand name "Junkyard Club" appears in a handful of user-facing pages. The cleanest approach is a targeted find-and-replace across those strings — no schema, route, or logic changes are needed. The Supabase project, Stripe products, edge functions, and DB tables don't carry the brand name in identifiers, so nothing on the backend has to move.

## Files to update

| File | Change |
|---|---|
| `src/pages/CheckoutReturn.tsx` (L82) | "Welcome to Junkyard Club" → "Welcome to Junkyard Surf Club" |
| `src/pages/Home.tsx` (L266) | Hero title "Junkyard Club" → "Junkyard Surf Club" |
| `src/pages/Home.tsx` (L531) | "…won a Junkyard Club giveaway." → "…won a Junkyard Surf Club giveaway." |
| `src/pages/Login.tsx` (L52) | "Junkyard Club" → "Junkyard Surf Club" |
| `src/pages/Subscribe.tsx` (L98, L133) | "Junkyard <span>Club</span>" → "Junkyard Surf <span>Club</span>" (keeps the teal accent on "Club") |
| `src/pages/Terms.tsx` (L10) | "By joining Junkyard Club…" → "By joining Junkyard Surf Club…" |
| `index.html` | Set `<title>` and `og:title` to "Junkyard Surf Club" + matching meta description (currently still the Lovable placeholders) |

## Intentionally left alone

- `src/pages/Signup.tsx` L233 — already says "Junkyard Surf" (the company name), correct as-is.
- `supabase/functions/payments-webhook/index.ts` L15 — internal code comment, not user-facing.
- `.lovable/plan.md` — internal scratchpad.
- Stripe product names, Brevo list, DB tables, env vars — unchanged (identifiers, not display copy).

## Out of scope (call out for follow-up if you want them done)

- Updating the Stripe **product display name** in the Stripe dashboard (shows on hosted invoices/receipts) — needs to be edited in Stripe, not in code.
- Updating the Brevo **sender name** on transactional emails.
- Favicon / logo asset swap.

Confirm and I'll apply the rename.
