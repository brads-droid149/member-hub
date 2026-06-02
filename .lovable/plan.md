## Goal

Let admins flip a member's `exempt_from_winning` flag directly from the Admin → Members page, so excluding staff/admins from the draw export no longer requires SQL.

## Changes

1. **`src/pages/admin/AdminMembers.tsx`**
   - Add a new "Exempt" column between Status and Joined.
   - Render a `Switch` per row bound to `r.exempt_from_winning`.
   - On toggle: optimistically update local state, call Supabase to update `members.exempt_from_winning` for that `user_id`, then `refresh()` on success. On error, revert and toast.
   - Disable the switch while the row's update is in flight.

2. **`src/contexts/AdminMembersContext.tsx`**
   - Add a `setExempt(userId, value)` helper on the context that performs the update via `supabase.from("members").update({ exempt_from_winning: value }).eq("user_id", userId)` and refreshes.
   - Existing `Admins can manage members` RLS policy already permits this — no DB migration needed.

3. **Draw export behaviour** — unchanged. `downloadDrawExport` already skips `exempt_from_winning` rows, so toggling the switch + re-downloading will exclude that member.

## Out of scope

- No schema/migration changes.
- No edge function (direct table update is fine under the existing admin RLS policy).
- No bulk-edit UI; one switch per row is enough for now.
