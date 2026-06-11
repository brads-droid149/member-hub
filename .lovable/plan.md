## Overview

Restructure the `OverviewSection.tsx` layout so the three cards sit side-by-side on desktop (Current Giveaway on the left, Your Entries + Past Winners stacked on the right) while keeping the current vertical stacking on mobile.

## Details

### Layout Changes

Replace the current `grid grid-cols-1 md:grid-cols-2 gap-6` wrapper with:

```
flex flex-col lg:flex-row gap-6
```

Inside it, arrange the three cards as follows:

1. **Current Giveaway card** (left column):
   - Add `lg:w-1/2`
   - Remove `md:col-span-2`
   - Prize image container classes updated to:
     ```
     max-w-sm mx-auto aspect-[4/5] w-full overflow-hidden rounded-lg
     ```
   - Keep existing image `object-cover object-center w-full h-full`
   - Keep placeholder fallback `w-full h-full`

2. **Right column wrapper** (a plain `<div>`):
   - `flex flex-col gap-6 lg:w-1/2`
   - Contains the two smaller cards below:

3. **Your Entries This Draw card** (top-right):
   - Keep all existing content and skeleton logic
   - No width class needed (fills the flex column)

4. **Past Winners card** (bottom-right):
   - Keep all existing content and skeleton logic
   - No width class needed (fills the flex column)

### Mobile Behavior
On screens below `lg`, `lg:flex-row` and `lg:w-1/2` no longer apply, so all three cards stack vertically in the flex column — matching the current mobile experience.

### Files to Edit
- `src/components/home/OverviewSection.tsx` only.

## Acceptance Criteria
- [ ] Desktop (≥1024px): Current Giveaway card sits on the left, Entries + Past Winners stacked on the right, all visible without scrolling.
- [ ] Mobile (<1024px): All three cards stack vertically as they do today.
- [ ] Prize image maintains portrait 4:5 ratio and is centred within the left card.
- [ ] Skeleton loading states continue to render correctly for all cards.