# Free-browsing review fix-ups

Three small corrections following the free-browsing rollout.

## 1. Yearly plan pre-selection (Subscribe page)

An explicit `?plan=` param always wins — `yearly` or `monthly`. Only when no `plan` param is present does the intent decide: `intent=discount` or `intent=entries` pre-selects yearly; anything else (including `intent=nav` or direct navigation) stays monthly.

## 2. Cancellation email copy

The cancellation email currently tells every member that access has ended. That is only true for deleted accounts.

- Deleted: unchanged — no longer billed, entries reset, access ended.
- Admin / portal / stale past-due: "You'll no longer be billed and your giveaway entries have been reset. You can still browse the club, but partner discounts and new entries are locked until you rejoin."

Headlines, subjects, and the "Rejoin the Club" button logic stay as they are.

## 3. "New Member" label

A free-browsing user with no membership currently sees "New Member". They should see "Browsing for free" instead. Month-count labels apply only once membership is active.

## Technical notes

- `src/pages/Subscribe.tsx`: compute `defaultPlan` before `useState<Plan>` — read `params.get("plan")` first and honour it when it is `"monthly"` or `"yearly"`; fall back to the intent-based default only when the param is absent or unrecognised.
- `supabase/functions/_shared/email-templates/billing-cancelled.tsx`: add a second `Record<Props['reason'], string>` (e.g. `CLOSINGS`) with all four keys, keeping `deleted` on the existing access-has-ended wording and giving `admin`, `portal`, and `stale_past_due` the new soft-downgrade wording. Render `CLOSINGS[reason]` in place of the hardcoded second paragraph so `deleted` is never folded into the new bucket.
- `src/components/home/OverviewSection.tsx`: it already receives both `monthsLabel` and `isMember`, so render `!isMember ? "Browsing for free" : monthsLabel` at line 99 — no changes needed in `Home.tsx`.
