## Goal
Change the annual membership from A$50/year to A$55/year across the app and Stripe.

## Changes

1. **Stripe price (sandbox + auto-synced to live on publish)**
   - Create a new price for product `membership` (or current product id) with:
     - `price_id: membership_yearly`
     - `amount: 5500` (A$55.00)
     - `currency: aud`
     - `recurring_interval: year`
     - `quantity_min: 1`, `quantity_max: 1`
   - Stripe transfers the `membership_yearly` lookup_key from the old A$50 price to the new A$55 price automatically — no code changes to `create-checkout` needed. Existing subscribers stay on their old price until renewal/upgrade (standard Stripe behavior).

2. **`src/pages/Subscribe.tsx`** (yearly plan card)
   - `price: "A$50"` → `price: "A$55"`
   - `sub: "Billed yearly. Save 17% vs monthly."` → `sub: "Billed yearly. Save ~8% vs monthly."` (monthly = $60/yr, yearly = $55 → ~8.3% saving)

## Not changing
- `create-checkout/index.ts` allowlist already uses the stable `membership_yearly` lookup key.
- Webhook, emails, members table — all amount-agnostic.
- `billing-emails-helpers_test.ts` `$50.00` is unrelated synthetic test data.
- Sitemap `yearly` is `changefreq`, unrelated.

## Question
Confirm the saving copy: keep "Save 17%" wording, change to "Save ~8%", or drop the savings line entirely?
