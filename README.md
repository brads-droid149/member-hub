# Junkyard Surf Club — Member Portal

Vite + React + TypeScript SPA backed by Lovable Cloud (Supabase) with Stripe-based membership billing.

## Local development

```bash
npm ci
npm run dev
```

Copy `.env.example` to `.env` and fill in real values. Never commit `.env`.

## Deployment

Deploys run automatically via GitHub Actions on every push to `main`. The workflow is defined in `.github/workflows/deploy.yml` and does the following:

1. Installs dependencies with `npm ci`
2. Builds the production bundle (`npm run build`) using secrets injected as environment variables
3. Deploys the resulting `dist/` folder to the configured static host (target domain: **members.junkyardsurf.com.au**)
4. Pushes any new Supabase migrations to the production database

The deploy step in the workflow is commented and includes ready-to-use blocks for Cloudflare Pages, Netlify, and Vercel — uncomment the one that matches your host and add the corresponding secrets.

### Required GitHub Actions secrets

Add these under **Settings → Secrets and variables → Actions → Production environment**:

Build-time (Vite) secrets:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_PAYMENTS_CLIENT_TOKEN`
- `VITE_STRIPE_PAYMENT_LINK`
- `VITE_STRIPE_PORTAL_URL`

Supabase migration secrets:
- `SUPABASE_ACCESS_TOKEN` — personal access token from the Supabase dashboard
- `SUPABASE_DB_PASSWORD` — database password for the production project
- `SUPABASE_PROJECT_REF` — project ref (e.g. `zsnhpkqisxwkfaurwcmu`)

Host-specific secrets (only the ones for the host you enable):
- Cloudflare Pages: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- Netlify: `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`
- Vercel: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

### Database migrations

The `migrate` job runs `supabase db push` against the linked production project after the build succeeds. To run migrations manually from your machine:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Migrations live in `supabase/migrations/` and are applied in filename (timestamp) order.

### Manual deploy

You can also trigger the workflow on demand via the **Actions** tab → **Deploy** → **Run workflow**.
