# Add tests for highest-risk flows

Add automated tests for three areas: the `payments-webhook` edge function, the `ProtectedRoute` component, and the `has_active_subscription` SQL function. Use the existing Vitest setup (`vitest.config.ts`, `src/test/setup.ts`). Delete the placeholder `src/test/example.test.ts`.

## 1. `payments-webhook` handler tests

File: `supabase/functions/payments-webhook/index.test.ts` (Deno test, run via the edge-function test tool — matches the existing `_test.ts` Deno convention).

The handler currently imports `verifyWebhook` and constructs the Supabase client at module scope. To make it testable without hitting Stripe or the real database, refactor `index.ts` minimally: export `handleWebhook` and accept optional injected `{ verifyWebhookFn, supabaseClient }` that default to the existing implementations. No production behavior change.

- **subscription.created → member active**: inject stub `verifyWebhookFn` returning a `customer.subscription.created` event with `metadata.userId`; inject a stub Supabase client recording calls. Assert `members` insert called with `status: 'active'`, `entries: 1`, `months_active: 1`.
- **subscription.deleted → cancelled + entries 0**: stub event type `customer.subscription.deleted` with `metadata.userId`. Assert `members` update called with `status: 'cancelled'`, `entries: 0`.
- **invalid signature → 400**: do NOT stub `verifyWebhookFn`; POST with a bogus `stripe-signature` and `?env=sandbox`. Assert response status is 400.

## 2. `ProtectedRoute` component tests

File: `src/test/ProtectedRoute.test.tsx`.

Mock `@/integrations/supabase/client` with `vi.mock` so `supabase.auth.getSession`, `supabase.auth.onAuthStateChange`, `supabase.rpc('has_role', …)`, and `supabase.from('members').select(...).eq(...).maybeSingle()` are controllable per test. Render with `MemoryRouter` + `<Routes>` containing `/protected`, `/login`, `/subscribe` so we can assert which route is rendered after redirect. Use `findByText` to wait past the loading spinner.

- **no session → /login**: `getSession` returns `{ session: null }`. Expect login route rendered.
- **session, no membership → /subscribe**: session present, `has_role` false, `members` query returns `null`. Expect subscribe route.
- **session + active member → children rendered**: session present, `has_role` false, `members` returns `{ status: 'active' }`. Expect "Protected!" content.
- **session + past_due member → children rendered**: session present, `has_role` false, `members` returns `{ status: 'past_due' }`. Expect "Protected!" content (dunning grace period — banner shown elsewhere, no redirect).
- **admin without membership → children rendered**: session present, `has_role` true, `members` null. Expect "Protected!" content.

## 3. `has_active_subscription` SQL function test

File: `src/test/has_active_subscription.test.ts`.

The project has no pgTAP harness, so test via a Vitest integration test that:

- Uses `@supabase/supabase-js` with the **service role key** read from a `SUPABASE_SERVICE_ROLE_KEY` test env var (skipped via `it.skipIf(!process.env.SUPABASE_SERVICE_ROLE_KEY)` so CI without secrets still passes).
- Creates a throwaway auth user, inserts three `subscriptions` rows for it (`active`, `past_due`, `canceled` with past `current_period_end`), calls `supabase.rpc('has_active_subscription', { user_uuid, check_env: 'sandbox' })` after each setup, asserts: `active` → true, `past_due` → true, `canceled` (expired) → false.
- Cleans up the user + rows in `afterAll`.

Document in the test file header that running it requires `SUPABASE_SERVICE_ROLE_KEY` in `.env` and that it writes to the real backend.

## Technical notes

- Keep `src/test/setup.ts` as-is.
- Delete `src/test/example.test.ts` (placeholder).
- Webhook refactor: export `handleWebhook` with an optional second arg for DI defaulting to current behavior — no behavior change in production.
- No new npm dependencies needed; `vitest`, `@testing-library/react`, `jsdom` already installed.
- Run frontend tests with the existing test runner; run the Deno webhook test with `supabase--test_edge_functions`.

## Files changed

- new `supabase/functions/payments-webhook/index.test.ts`
- edited `supabase/functions/payments-webhook/index.ts` (export + DI seam only)
- new `src/test/ProtectedRoute.test.tsx`
- new `src/test/has_active_subscription.test.ts`
- deleted `src/test/example.test.ts`
