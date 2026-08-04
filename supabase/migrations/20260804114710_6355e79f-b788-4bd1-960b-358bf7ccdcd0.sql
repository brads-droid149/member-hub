CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid uuid, check_env text DEFAULT 'live'::text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Non-admin callers may only ask about themselves. Server-side/internal roles
  -- (service_role, postgres) are exempt so edge functions and cron keep working.
  IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    IF auth.uid() IS NULL THEN
      RETURN false;
    END IF;
    IF user_uuid IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
      RETURN false;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = user_uuid
      AND environment = check_env
      AND (
        (status IN ('active', 'trialing', 'past_due') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated, service_role;