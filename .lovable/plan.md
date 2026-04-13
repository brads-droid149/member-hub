

# Member Portal — Implementation Plan

## Summary
Build a dark-themed SPA member portal with sidebar navigation (Dashboard, Partners & Discounts, Membership Settings), email/password auth via Lovable Cloud, Stripe subscription integration, and compounding entry logic (+1/month active).

## Architecture

```text
┌─────────────────────────────────────────────┐
│  App Shell (SidebarProvider + Layout)       │
│  ┌──────────┐  ┌──────────────────────────┐ │
│  │ Sidebar  │  │  Page Content            │ │
│  │─Dashboard│  │  (routed via React       │ │
│  │─Partners │  │   Router, SPA)           │ │
│  │─Settings │  │                          │ │
│  └──────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Steps

### 1. Enable Supabase (Lovable Cloud)
- Set up auth with email/password
- Create database tables: `profiles`, `members`, `entries`, `giveaways`, `past_winners`, `partners`
- RLS policies for member data access

### 2. Enable Stripe Integration
- Use the existing Stripe account (enable_stripe tool)
- Create webhook edge function for subscription events (active/paused/cancelled)
- Entry logic: +1 entry per month active, reset on cancel or win

### 3. Database Schema
- **profiles** — user_id, full_name, avatar_url
- **members** — user_id, stripe_customer_id, stripe_subscription_id, status (active/paused/cancelled), months_active, created_at
- **entries** — user_id, count (computed from months_active, reset on cancel/win)
- **partners** — name, logo_url, discount_code, description
- **giveaways** — id, title, prize_image, draw_date, is_active
- **past_winners** — giveaway_id, winner_name, prize_title, won_at

### 4. Auth Pages
- Login page (email/password)
- Signup page
- Protected route wrapper

### 5. App Shell & Navigation
- Dark theme (Junkyard Surf style — dark backgrounds, light text)
- Sidebar with 3 nav items: Dashboard, Partners & Discounts, Membership Settings
- Using existing Shadcn Sidebar component

### 6. Dashboard Page
- Hero metric: large entry count display
- Member name + status badge (active/paused/cancelled)
- Months active counter
- Next draw date
- Current giveaway block (prize image, title, entries, draw date)
- Past winners list (social proof)

### 7. Partners & Discounts Page
- Grid of 16 partner cards (placeholder brands at launch)
- Each card: partner name, discount code
- Click-to-copy with toast confirmation

### 8. Membership Settings Page
- Pause membership (max 3 months, clearly shown)
- Cancel membership with dynamic warning ("Your X entries will reset to zero")
- Update payment details (redirect to Stripe Customer Portal)

### 9. Stripe Webhook Edge Function
- Handle `customer.subscription.updated`, `customer.subscription.deleted`
- Update member status and entry counts accordingly
- Handle pause/resume via subscription schedule

## Design Direction
- Dark background (#0a0a0a or similar)
- Light/white text
- Accent color for CTAs and entry count highlight
- Clean, minimal, fast-feeling UI

## Technical Notes
- All navigation is client-side (React Router, no reloads)
- Dashboard is the default landing page after login
- Entry count = months_active (resets to 0 on cancel or win)
- Stripe Customer Portal for payment updates (no embedded form needed)

