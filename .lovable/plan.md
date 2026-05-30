## Fix: Authenticate `create-checkout` and Use Verified `user.id`

### Problem
`create-checkout` accepts anonymous requests and trusts a client-supplied `userId`, allowing any caller to link a Stripe checkout session to any account.

### Solution
Mirror the auth pattern from `create-portal-session/index.ts`, then use the verified `user.id` from the JWT instead of `body.userId`. This removes the need for a 403 mismatch check — the server never trusts client-supplied identity.

### Changes
**File:** `supabase/functions/create-checkout/index.ts`

1. Add `import { createClient } from "npm:@supabase/supabase-js@2"`.
2. Add a module-level admin Supabase client using `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
3. In the POST handler, before parsing the body or calling Stripe:
   - Read the `Authorization` header and extract the Bearer token.
   - Call `supabase.auth.getUser(token)`.
   - Return **401 Unauthorized** if the token is missing, invalid, or no user is returned.
4. Parse the body and call `createCheckoutSession({ ..., userId: user.id })` — ignore `body.userId` entirely. No 403 check is needed because the server never reads a client-supplied user id.
5. Leave all other logic untouched (price lookup, `resolveOrCreateCustomer`, Stripe session creation, error handling, `customerEmail`, `returnUrl`, `environment`).

### Safety Check
`body.userId` is only forwarded into `createCheckoutSession`, where it is used for:
- Stripe customer metadata lookup (`metadata['userId']`)
- Stripe customer creation metadata
- Checkout session metadata (and subscription metadata for recurring)

All three uses are strictly improved by substituting the verified JWT `user.id`. No downstream code depends on `body.userId` differing from the authenticated user.

### Deployment
- Edge function auto-deploys on save.
- Existing `Subscribe` flow already calls `supabase.functions.invoke("create-checkout", ...)`, which automatically attaches the session Bearer token, so the client side needs no changes.