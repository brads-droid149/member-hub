
-- 1. Enforce uniqueness on profiles.phone (existing 23 rows already unique)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx
  ON public.profiles (phone)
  WHERE phone IS NOT NULL;

-- 2. Public RPC so the signup form can check duplicates BEFORE creating an auth user.
-- SECURITY DEFINER bypasses the profiles RLS that hides other users' rows.
CREATE OR REPLACE FUNCTION public.phone_exists(_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE phone = _phone
  );
$$;

GRANT EXECUTE ON FUNCTION public.phone_exists(text) TO anon, authenticated;

-- 3. Enable realtime on the members table so the dashboard reflects
-- portal cancels/pauses and webhook updates without a page reload.
ALTER PUBLICATION supabase_realtime ADD TABLE public.members;

-- 4. Schedule the existing entitlement maintenance functions.
-- Both are idempotent SQL functions; daily cadence is sufficient.
SELECT cron.schedule(
  'credit-monthly-entries-daily',
  '15 0 * * *',
  $$ SELECT public.credit_monthly_entries(); $$
);

SELECT cron.schedule(
  'cancel-stale-past-due-daily',
  '30 0 * * *',
  $$ SELECT public.cancel_stale_past_due_members(); $$
);
