Fix .env files being tracked in git — a critical security issue where Stripe and Supabase keys are in version control.

1. Update `.gitignore` to add at the top:
   ```
   .env
   .env.*
   !.env.example
   ```

2. Create `.env.example` with all keys found across .env files, using placeholder values:
   - `VITE_SUPABASE_PROJECT_ID=your_supabase_project_id`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key`
   - `VITE_SUPABASE_URL=your_supabase_url`
   - `VITE_STRIPE_PAYMENT_LINK=your_stripe_payment_link`
   - `VITE_STRIPE_PORTAL_URL=your_stripe_portal_url`
   - `VITE_PAYMENTS_CLIENT_TOKEN=your_stripe_publishable_key`

3. Add comment at top of `.env.example`: "Copy this file to .env and fill in real values. Never commit .env to git."

4. Do not delete the actual .env, .env.development, or .env.production files from disk — only stop tracking them in git.

Note: per project guidelines, `.env` files are auto-generated and managed by the Supabase integration, but they still must not be committed to version control.