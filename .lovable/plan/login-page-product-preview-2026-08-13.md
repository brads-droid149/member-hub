# Login page product preview

Add read-only marketing preview sections below the existing sign-in card on `/login`. The auth form itself is untouched — no changes to fields, state, validation, or submit handlers, and nothing new is added to `Signup.tsx`.

## What gets added

### 1. Home preview (new `src/components/home/LoginHomePreview.tsx`)
Built fresh as a display-only component (not derived from `OverviewSection`):
- Pricing block: A$5/month and A$55/year, matching the plan copy on the Subscribe page.
- "How it works" copy: join → get a monthly giveaway entry that compounds while you stay a member → unlock partner discount codes.
- Giveaway board: giveaway data stays members-only (your decision), so this renders a static locked teaser card — a lock icon with "Sign in to see this month's giveaway" — and makes **no** database call for giveaways.

### 2. Partner preview (new `src/components/home/LoginPartnersPreview.tsx`)
Built fresh, fetch-only, no interactive affordances:
- Reads `partners_preview` (id, name, logo_url, description, website_url only — never `discount_code`).
- Renders a grid of logo / name / description cards, each ending with a quiet "Join to unlock this code" CTA linking to `/signup`.
- Shows a fixed-height skeleton grid while loading and renders nothing extra if the list comes back empty.

### 3. Learn-more link
Below the existing "No account? Sign up" line, a low-emphasis text link: "Still deciding? Learn more about Junkyard Club" → `https://www.junkyardsurf.com.au/junkyard-surf-club`, `target="_blank" rel="noopener noreferrer"`, muted text with hover underline so it does not compete with the signup CTA.

## Database change (separate, reviewable migration)

```sql
GRANT EXECUTE ON FUNCTION public.get_partners_preview() TO anon;
GRANT SELECT ON public.partners_preview TO anon;
```

Nothing else is touched: no policy changes on `partners`, `giveaways`, `past_winners`, `members`, or `subscriptions`, and no new columns exposed.

Note: `partners_preview` is a `security_invoker` view over the SECURITY DEFINER function, so both grants are required for anonymous reads to work. Prior migrations explicitly revoked anon on both objects; this migration deliberately reverses that for the login-page preview.

## Technical notes

- Both new components live below the auth `Card` in a separate container; the auth card keeps its own fixed layout so preview loading cannot shift or re-render it. Preview state is local to each new component — no shared state with the login form, and no `useHomeData`.
- No fetches to `members`, `subscriptions`, or `profiles` anywhere on this page; the partner fetch is the only network call added and works fully anonymously.
- Page layout changes from a centred single card to a centred column: auth card at the top, preview sections stacked beneath, with the existing SEO/Helmet block extended only in description wording if needed.
- Verification: load `/login` signed out, confirm partner cards render for an anonymous visitor, confirm no console errors, and confirm the auth inputs keep focus/value while the partner fetch resolves.
