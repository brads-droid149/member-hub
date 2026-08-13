# Live giveaway image on the login preview

Right now the giveaway tile on the login page uses a hand-edited constant (`GIVEAWAY_IMAGE_URL`) and shows a placeholder. This makes it pull the real active giveaway you set in the admin Giveaway Manager, automatically.

## What changes

- The login page giveaway tile shows the **current active giveaway's image and title** — the same one admins upload in the admin panel.
- If no active giveaway exists (or it has no image), the tile keeps the existing clean placeholder state.
- Nothing else is exposed to logged-out visitors: only title, image and draw date — no entry counts, no member data.
- Auth form, signup, partner preview and existing giveaway policies stay untouched.

## Technical details

1. Migration: add a security-definer function `public.get_active_giveaway_preview()` returning `title`, `prize_image_url`, `draw_date` for the single `is_active = true` giveaway. `GRANT EXECUTE` to `anon` and `authenticated`. The `giveaways` table's own RLS stays authenticated-only — no policy change.
2. `src/components/home/LoginHomePreview.tsx`: replace the `GIVEAWAY_TITLE` / `GIVEAWAY_IMAGE_URL` constants with a small fetch of that RPC on mount; render image when returned, otherwise the existing placeholder block. Layout, aspect ratio and the rest of the component are unchanged (no layout shift — the tile keeps its fixed aspect box while loading).
3. Giveaway images already live in a bucket that serves direct public fetches, so anonymous visitors can load them without further storage changes.
