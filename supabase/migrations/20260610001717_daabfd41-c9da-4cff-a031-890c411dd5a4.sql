
-- 1. Pin search_path on the pgmq wrapper functions so they cannot be hijacked
--    by malicious schemas placed earlier on the search path.
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- 2. Revoke EXECUTE on internal-only SECURITY DEFINER functions.
--    These are invoked by triggers, cron jobs, or service-role edge functions —
--    never by anon or authenticated clients.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_stale_past_due_members() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_monthly_entries() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- get_admin_members_overview is called by admins only — restrict to authenticated.
REVOKE EXECUTE ON FUNCTION public.get_admin_members_overview() FROM PUBLIC, anon;

-- phone_exists is used during signup (anon) so keep that grant explicit.
REVOKE EXECUTE ON FUNCTION public.phone_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.phone_exists(text) TO anon, authenticated;

-- has_role and has_active_subscription are called by the authenticated client.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon;

-- 3. Harden the user_roles "manage" policy so an INSERT/UPDATE is also forced
--    through an admin WITH CHECK, not just the USING clause.
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
