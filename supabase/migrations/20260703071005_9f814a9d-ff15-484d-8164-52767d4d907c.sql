
-- 1. Fix mutable search_path on internal functions
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

-- 2. Revoke EXECUTE on internal SECURITY DEFINER functions from client roles.
--    These are only meant to be invoked by edge functions (service_role),
--    cron jobs, or triggers — never directly by anon or signed-in clients.
REVOKE EXECUTE ON FUNCTION public.cancel_stale_past_due_members()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_monthly_entries()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint)                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake()                          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb)      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()                  FROM PUBLIC, anon, authenticated;

-- Ensure service_role retains execute on those (it's the intended caller).
GRANT EXECUTE ON FUNCTION public.cancel_stale_past_due_members()              TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_monthly_entries()                     TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint)                   TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)                   TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch()                       TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_wake()                           TO service_role;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text)          TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb)       TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer)     TO service_role;

-- Client-facing helpers stay executable by signed-in users.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)                                     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_members_overview(text, integer, integer, text, text)      TO authenticated, service_role;

-- 3. Realtime channel authorization: only allow signed-in users to attach to a
--    channel named after their own user id. Postgres_changes on public.members
--    is already filtered by table RLS; this policy blocks strangers from
--    subscribing to arbitrary broadcast/presence topics.
DROP POLICY IF EXISTS "Users can only join their own realtime channel" ON realtime.messages;
CREATE POLICY "Users can only join their own realtime channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
);
