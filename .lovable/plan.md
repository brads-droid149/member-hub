# Sidebar Layout Refactor for Home

Reorganise the current single-page `Home.tsx` into a persistent sidebar shell with four sections, each in its own component file. All existing logic, Supabase queries, realtime subscriptions, and toast notifications are preserved verbatim — only layout and file structure change.

## New file structure

```
src/pages/Home.tsx                  // shell: SidebarProvider + AppSidebar + active section
src/components/home/AppSidebar.tsx  // sidebar with logo + 4 nav items + Admin/Sign Out footer
src/components/home/OverviewSection.tsx
src/components/home/PartnersSection.tsx
src/components/home/WinnersSection.tsx
src/components/home/SettingsSection.tsx
```

## Sidebar

- Uses existing `Sidebar`, `SidebarProvider`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`, `SidebarTrigger` from `@/components/ui/sidebar` with `collapsible="icon"` so it shrinks to icons on desktop and becomes an off-canvas sheet on mobile (already handled by the shadcn component via `useIsMobile`).
- Top of sidebar: "Junkyard Surf Club" wordmark (same `font-display font-bold` styling used today in the header).
- Nav items (with lucide icons already imported in Home): Overview (`LayoutGrid`), Partner Discounts (`Tag`), Past Winners (`Trophy`), Settings (`SettingsIcon`).
- Active item highlighted via `SidebarMenuButton isActive={active === id}`.
- Sidebar footer: Admin link (if `useAdmin().isAdmin`) and Sign Out button — moves the existing top-bar actions into the sidebar.
- Mobile: a `SidebarTrigger` (hamburger) lives in a small sticky top bar above the main content so the sidebar can be reopened when collapsed off-canvas.

## Section state & lazy data fetching

`Home.tsx` owns:
- `active` state: `"overview" | "partners" | "winners" | "settings"`, default `"overview"`.
- A `loaded` set tracking which sections have been visited.
- Shared state needed by the banners and multiple sections: `userId`, `member`, `subscription`, `authName`, and the realtime members channel (kept exactly as today). These load on mount because the past-due / cancel-at-period-end alerts must render on every section.
- A `setActive` callback passed to both the sidebar and to `OverviewSection` (so the "See All Winners" link calls `setActive("winners")` instead of navigating).

Each section component fetches only its own data on first mount:

| Section | Queries (run on first visit only) |
|---|---|
| Overview | `giveaways` (active), `past_winners` (top 3 for preview), plus reads shared `member` for entries counter |
| Partner Discounts | `partners` ordered + alphabetised, owns `copied` state and `handleCopy` |
| Past Winners | `past_winners` full list ordered by `draw_date` |
| Settings | `profiles` row for the form, owns profile + password form state and all three handlers (`handleSaveProfile`, `handleChangePassword`, `handleManageSubscription`) |

To keep behaviour identical, Overview's winners preview re-fetches its own top-3 list independently of the Past Winners section (small query, simpler than sharing). "See All Winners" is a `<button>` that calls `setActive("winners")`.

## Banners and shared chrome

The two existing alerts (`past_due` and `cancel_at_period_end`) stay in `Home.tsx` rendered above the active section content, using the shared `member`/`subscription` state and `handleManageSubscription` (kept in the shell since it's also used by Settings — passed down as a prop, or each owner defines its own copy; plan: keep one copy in the shell for the banner and a separate copy in Settings to keep components self-contained, since the function has no shared state).

## Routing

No route changes. `/` still renders `Home`. Section switching is in-component state, not URL — matches the request ("navigate to the Past Winners tab in the sidebar").

## Styling

- Existing dark theme tokens and `font-display` are reused; no new colors.
- Main content keeps the current `max-w-5xl mx-auto px-6 py-10` container, now nested inside `SidebarInset` / a flex child next to the sidebar.
- Per shadcn-sidebar guidance, the outer flex wrapper uses `w-full` and `min-h-screen`.

## Out of scope

- No changes to Supabase schema, edge functions, or business logic.
- No changes to other routes (`/admin`, `/login`, etc.).
- No new dependencies.
