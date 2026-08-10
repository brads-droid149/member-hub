REVOKE EXECUTE ON FUNCTION public.system_health_snapshot() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.system_health_snapshot() TO service_role;