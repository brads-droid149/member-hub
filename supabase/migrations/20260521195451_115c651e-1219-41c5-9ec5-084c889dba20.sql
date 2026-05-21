-- Track when a member first entered past_due, and auto-cancel after 7 days
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS past_due_since timestamp with time zone;

CREATE OR REPLACE FUNCTION public.cancel_stale_past_due_members()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.members
  SET
    status = 'canceled',
    past_due_since = NULL,
    updated_at = now()
  WHERE status = 'past_due'
    AND past_due_since IS NOT NULL
    AND past_due_since <= now() - interval '7 days';
END;
$$;

-- Schedule daily check (runs at 00:10 UTC)
SELECT cron.unschedule('cancel-stale-past-due-members')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cancel-stale-past-due-members');

SELECT cron.schedule(
  'cancel-stale-past-due-members',
  '10 0 * * *',
  $$ SELECT public.cancel_stale_past_due_members(); $$
);