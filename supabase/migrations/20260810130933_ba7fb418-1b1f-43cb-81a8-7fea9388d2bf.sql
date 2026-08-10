CREATE OR REPLACE FUNCTION public.credit_monthly_entries()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.members m
  SET
    entries = m.entries + 1,
    months_active = m.months_active + 1,
    last_entry_credited_at = m.last_entry_credited_at + interval '1 month',
    updated_at = now()
  WHERE m.status IN ('active', 'past_due')
    AND m.last_entry_credited_at <= now() - interval '1 month'
    AND (
      m.billing_exempt = true
      OR EXISTS (
        SELECT 1 FROM public.subscriptions s
        WHERE s.user_id = m.user_id
          AND s.status IN ('active', 'trialing', 'past_due')
          AND (s.current_period_end IS NULL OR s.current_period_end > now())
      )
    );
END;
$function$;