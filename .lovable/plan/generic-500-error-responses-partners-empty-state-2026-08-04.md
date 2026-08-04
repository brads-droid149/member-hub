# Generic 500 error responses + partners empty state

## Fix 1: Stop leaking raw exception messages (5 edge functions)

In each function's final catch-all block, keep `console.error(...)` with the full error (server-side logs unchanged) and replace the response body with a fixed generic message:

```
{ "error": "Something went wrong. Please try again." }  // status 500
```

Files and lines to change:
- `supabase/functions/admin-cancel-member/index.ts` (~165)
- `supabase/functions/admin-update-member/index.ts` (~69)
- `supabase/functions/create-checkout/index.ts` (~230)
- `supabase/functions/create-portal-session/index.ts` (~93)
- `supabase/functions/delete-account/index.ts` (~130)

All earlier, purpose-written responses stay exactly as they are: 401 Unauthorized, 403 Forbidden, 400 "Invalid userId" / "Invalid returnUrl" / "Invalid priceId", Zod validation errors, 404s, and 405 Method not allowed.

### One related leak worth including
Two functions return a raw database/Stripe message from a non-catch branch:
- `admin-update-member` returns `updateError.message` on a failed members update (500).
- `delete-account` returns `delError.message` on a failed auth user deletion (500).

These leak the same class of internal detail. Proposal: log them in full and return the same generic 500 message. Say the word if you'd rather leave those untouched and limit the change strictly to the catch blocks.

### Note on scope
`auth-email-hook` and `brevo-sync-contact` use the same pattern but are not in your list, so they are left alone.

## Fix 2: PartnersSection empty state

`src/components/home/PartnersSection.tsx` already handles this — the render is a three-way branch (loading skeletons / grid when `rows.length > 0` / else) and the else branch renders:

```
<p className="text-sm text-muted-foreground text-center py-12">No partner discounts available yet</p>
```

That matches WinnersSection's styling exactly (`text-sm text-muted-foreground text-center py-12`). The only difference from your description is the wording: "available yet" vs "available right now".

Planned action: leave the structure as is, and optionally reword to "No partner discounts available right now" if you prefer that phrasing.

## Verification
- Run the existing Deno tests for the affected functions to confirm the specific 400/401/403 assertions still pass.
- Deploy the five functions and force a failure (e.g. invalid Stripe state in test mode) to confirm the client sees only the generic message.
- Check function logs to confirm the full original error is still recorded.
- Load the members home view with partners present and confirm the grid is unchanged.
