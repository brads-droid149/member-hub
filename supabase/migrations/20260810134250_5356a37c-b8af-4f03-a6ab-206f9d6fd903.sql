REVOKE ALL ON FUNCTION public.system_health_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.system_health_snapshot() FROM anon;
REVOKE ALL ON FUNCTION public.system_health_snapshot() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.system_health_snapshot() TO service_role;