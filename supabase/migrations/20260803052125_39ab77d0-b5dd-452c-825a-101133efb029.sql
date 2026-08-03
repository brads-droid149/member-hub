CREATE OR REPLACE FUNCTION public.credit_monthly_entries()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.members
  SET
    entries = entries + 1,
    months_active = months_active + 1,
    last_entry_credited_at = last_entry_credited_at + interval '1 month',
    updated_at = now()
  WHERE status IN ('active', 'past_due')
    AND last_entry_credited_at <= now() - interval '1 month';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.credit_monthly_entries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_monthly_entries() TO service_role;