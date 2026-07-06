# Add Tolt lead tracking to signup

## Scope
Only one signup path exists in the app: email/password in `src/pages/Signup.tsx`. There is no OAuth/social signup route today, so a single integration point covers all current signup flows. (Note for later: if a future paid-conversion flow allows account creation inside the Stripe checkout without visiting `/signup`, that will need its own Tolt call — out of scope here.)

## Changes

**`src/pages/Signup.tsx`**
1. Add a module-scope helper `trackToltSignup(email)` matching the spec:
   - Returns early if `window.tolt_data` is missing (visitor wasn't referred).
   - Returns early if `window.tolt_data.customer_id` exists (already tracked).
   - Wraps `window.tolt.signup(email)` in try/catch, logging errors to `console.error`.
2. In `handleSignup`, place the call **once**, immediately after the `if (error) { … return; }` guard and **before** the `if (data.session) { navigate("/subscribe") } else { navigate("/check-email") }` branch. This guarantees Tolt fires on every successful signup — both the auto-signed-in path and the email-verification path — with no duplication.
3. Fire-and-forget: call `trackToltSignup(email.trim())` without `await`, so the user is never blocked or delayed even if the Tolt script hasn't loaded or the call fails.
4. Add a minimal inline `declare global` block typing `window.tolt` / `window.tolt_data` so the code typechecks without touching shared types.

## Non-goals / guarantees
- No change to the Supabase `signUp` call, its arguments, or the surrounding validation.
- No change to navigation, toast, or Brevo sync behavior.
- No change to `index.html` (Tolt script tag was added previously).
- No new dependencies.
