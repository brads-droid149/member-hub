## What's happening

It isn't the browser reloading the page — it's the app throwing away its screen and rebuilding it.

`src/components/ProtectedRoute.tsx` subscribes to auth state changes, and its handler does this on **every** event:

```ts
supabase.auth.onAuthStateChange((_e, s) => {
  setAccess("loading");   // <- wipes the screen
  evaluate(s);
});
```

The client is configured with `autoRefreshToken: true` (`src/integrations/supabase/client.ts`), and Supabase re-checks/refreshes the session whenever the tab becomes visible again. That fires `TOKEN_REFRESHED` (and often `SIGNED_IN`), so coming back to the tab:

1. `access` flips to `loading` → the spinner replaces the whole route,
2. `Home` unmounts, losing all its local state (active section resets to Overview, giveaway/winners/partners caches cleared),
3. `evaluate()` re-runs two round-trips (`has_role`, then `members`), and `useHomeData` re-mounts and refetches profile/member/subscription and re-opens the realtime channel.

That sequence is what reads as a reload.

## Fix

**1. `src/components/ProtectedRoute.tsx` — don't reset to loading on benign events**

- Only show the loading state on the initial evaluation. Keep the current `access` value while re-evaluating in the background.
- Ignore events that can't change access: `TOKEN_REFRESHED`, `INITIAL_SESSION`, and `USER_UPDATED`.
- Treat `SIGNED_IN` as a no-op when the user id is unchanged from the one already evaluated (tab-focus re-emits it for the same user); only re-evaluate on a genuine user change.
- Still re-evaluate immediately on `SIGNED_OUT` and on a `SIGNED_IN` with a different user id.
- Track the last evaluated user id in a ref so the comparison survives re-renders.

Net effect: returning to the tab leaves the rendered dashboard exactly as it was.

**2. `src/hooks/use-home-data.ts` — avoid redundant refetch churn (optional, same turn)**

The hook's effect already has an empty dep array, so with fix 1 it stops re-running on tab focus. No change strictly needed; leave it as is unless the mount-guard needs adjusting once fix 1 lands.

## Verification

- Load `/` in the preview signed in, switch to another section (e.g. Partner Discounts), switch browser tabs and come back: the section and content should persist with no spinner flash.
- Confirm sign-out still redirects to `/login`, and that a signed-out user hitting `/` still gets redirected.
- Run the existing `src/test/ProtectedRoute.test.tsx` suite and extend it with a case asserting a `TOKEN_REFRESHED` event does not return the component to the loading state.
