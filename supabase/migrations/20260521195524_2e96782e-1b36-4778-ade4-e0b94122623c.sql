CREATE OR REPLACE FUNCTION public.cancel_stale_past_due_members()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.members
  SET
    status = 'cancelled',
    past_due_since = NULL,
    updated_at = now()
  WHERE status = 'past_due'
    AND past_due_since IS NOT NULL
    AND past_due_since <= now() - interval '7 days';
END;
$$;