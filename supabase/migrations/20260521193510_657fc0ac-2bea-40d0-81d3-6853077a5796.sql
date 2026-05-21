
-- Track when the member last received a monthly +1 entry credit.
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS last_entry_credited_at timestamptz NOT NULL DEFAULT now();

-- Backfill existing members so the cron has a baseline.
UPDATE public.members SET last_entry_credited_at = COALESCE(updated_at, created_at, now())
WHERE last_entry_credited_at IS NULL;

-- Credit +1 entry / +1 month_active for each active member whose last credit
-- was >= 1 month ago. Loops to catch up if more than one month elapsed.
CREATE OR REPLACE FUNCTION public.credit_monthly_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.members
  SET
    entries = entries + 1,
    months_active = months_active + 1,
    last_entry_credited_at = last_entry_credited_at + interval '1 month',
    updated_at = now()
  WHERE status = 'active'
    AND last_entry_credited_at <= now() - interval '1 month';
END;
$$;

-- Schedule daily at 00:05 UTC.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'credit-monthly-entries') THEN
    PERFORM cron.unschedule('credit-monthly-entries');
  END IF;
  PERFORM cron.schedule(
    'credit-monthly-entries',
    '5 0 * * *',
    $cron$SELECT public.credit_monthly_entries();$cron$
  );
END;
$$;
