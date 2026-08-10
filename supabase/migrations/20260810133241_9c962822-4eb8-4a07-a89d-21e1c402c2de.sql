CREATE OR REPLACE FUNCTION public.system_health_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  issues jsonb := '[]'::jsonb;
  n bigint;
  m bigint;
  detail jsonb;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND session_user NOT IN ('postgres', 'supabase_admin')
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- 1. Emails that failed permanently in the last 24h
  -- Repeat signups on an already-confirmed account never get a new confirmation
  -- email by design, so those rows are excluded from alerting.
  SELECT count(*) INTO n FROM public.email_send_log l
  WHERE l.status IN ('dlq', 'failed', 'bounced', 'complained')
    AND l.created_at > now() - interval '24 hours'
    AND NOT (
      l.template_name = 'signup'
      AND EXISTS (
        SELECT 1 FROM auth.users u
        WHERE lower(u.email) = lower(l.recipient_email)
          AND u.email_confirmed_at IS NOT NULL
      )
    );
  IF n > 0 THEN
    SELECT jsonb_agg(jsonb_build_object('template', template_name, 'to', recipient_email, 'status', status, 'error', error_message, 'at', created_at))
      INTO detail FROM (
        SELECT l.template_name, l.recipient_email, l.status, l.error_message, l.created_at
        FROM public.email_send_log l
        WHERE l.status IN ('dlq','failed','bounced','complained')
          AND l.created_at > now() - interval '24 hours'
          AND NOT (
            l.template_name = 'signup'
            AND EXISTS (
              SELECT 1 FROM auth.users u
              WHERE lower(u.email) = lower(l.recipient_email)
                AND u.email_confirmed_at IS NOT NULL
            )
          )
        ORDER BY l.created_at DESC LIMIT 10
      ) t;
    issues := issues || jsonb_build_array(jsonb_build_object(
      'key', 'email_failures', 'severity', 'critical',
      'title', n || ' email(s) failed to deliver in the last 24 hours',
      'detail', jsonb_build_object('count', n, 'recent', coalesce(detail, '[]'::jsonb))));
  END IF;

  -- 2. Emails stuck in "pending" for more than 15 minutes
  SELECT count(*) INTO n FROM (
    SELECT DISTINCT ON (l.message_id) l.message_id, l.status, l.created_at, l.template_name, l.recipient_email
    FROM public.email_send_log l
    WHERE l.message_id IS NOT NULL AND l.created_at > now() - interval '24 hours'
    ORDER BY l.message_id, l.created_at DESC
  ) latest
  WHERE latest.status = 'pending'
    AND latest.created_at < now() - interval '15 minutes'
    AND NOT (
      latest.template_name = 'signup'
      AND EXISTS (
        SELECT 1 FROM auth.users u
        WHERE lower(u.email) = lower(latest.recipient_email)
          AND u.email_confirmed_at IS NOT NULL
      )
    );
  IF n > 0 THEN
    issues := issues || jsonb_build_array(jsonb_build_object(
      'key', 'email_stuck', 'severity', 'critical',
      'title', n || ' email(s) stuck in the sending queue for over 15 minutes',
      'detail', jsonb_build_object('count', n)));
  END IF;

  -- 3. Active/past-due members without a paying subscription
  SELECT count(*) INTO n FROM public.members mm
  WHERE mm.status IN ('active', 'past_due')
    AND mm.billing_exempt = false
    AND NOT EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = mm.user_id
        AND s.status IN ('active', 'trialing', 'past_due')
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
    );
  IF n > 0 THEN
    issues := issues || jsonb_build_array(jsonb_build_object(
      'key', 'members_without_subscription', 'severity', 'critical',
      'title', n || ' active member(s) have no matching paid subscription',
      'detail', jsonb_build_object('count', n)));
  END IF;

  -- 4. Members currently in the past-due dunning window
  SELECT count(*) INTO n FROM public.members WHERE status = 'past_due';
  IF n > 0 THEN
    issues := issues || jsonb_build_array(jsonb_build_object(
      'key', 'members_past_due', 'severity', 'warning',
      'title', n || ' member(s) have a failed payment (past due)',
      'detail', jsonb_build_object('count', n)));
  END IF;

  -- 5. Subscriptions in a broken Stripe state
  SELECT count(*) INTO n FROM public.subscriptions
  WHERE status IN ('incomplete', 'incomplete_expired', 'unpaid')
    AND updated_at > now() - interval '7 days';
  IF n > 0 THEN
    issues := issues || jsonb_build_array(jsonb_build_object(
      'key', 'subscriptions_broken', 'severity', 'warning',
      'title', n || ' subscription(s) are stuck in an incomplete/unpaid state',
      'detail', jsonb_build_object('count', n)));
  END IF;

  -- 6. Stripe webhook silence (only alarming once we have members)
  SELECT count(*) INTO m FROM public.members;
  SELECT count(*) INTO n FROM public.stripe_webhook_events WHERE created_at > now() - interval '48 hours';
  IF m > 0 AND n = 0 THEN
    issues := issues || jsonb_build_array(jsonb_build_object(
      'key', 'stripe_webhook_silence', 'severity', 'warning',
      'title', 'No Stripe webhook events received in the last 48 hours',
      'detail', jsonb_build_object('members', m)));
  END IF;

  -- 7. Scheduled jobs missing
  SELECT count(*) INTO n FROM cron.job
  WHERE active AND jobname IN ('credit-monthly-entries-daily', 'process-stale-past-due-daily');
  IF n < 2 THEN
    issues := issues || jsonb_build_array(jsonb_build_object(
      'key', 'cron_jobs_missing', 'severity', 'critical',
      'title', 'One or more scheduled background jobs are missing or inactive',
      'detail', jsonb_build_object('active_jobs', n, 'expected', 2)));
  END IF;

  -- 8. No active giveaway configured
  SELECT count(*) INTO n FROM public.giveaways WHERE is_active = true;
  IF n = 0 THEN
    issues := issues || jsonb_build_array(jsonb_build_object(
      'key', 'no_active_giveaway', 'severity', 'warning',
      'title', 'No active giveaway is configured',
      'detail', jsonb_build_object('count', 0)));
  END IF;

  -- 9. Signed-up users missing a profile row
  SELECT count(*) INTO n FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id);
  IF n > 0 THEN
    issues := issues || jsonb_build_array(jsonb_build_object(
      'key', 'profiles_missing', 'severity', 'critical',
      'title', n || ' signed-up user(s) have no profile record',
      'detail', jsonb_build_object('count', n)));
  END IF;

  -- 10. Marketing sync backlog
  SELECT count(*) INTO n FROM public.profiles
  WHERE brevo_synced = false AND created_at < now() - interval '24 hours';
  IF n > 3 THEN
    issues := issues || jsonb_build_array(jsonb_build_object(
      'key', 'brevo_backlog', 'severity', 'warning',
      'title', n || ' member profile(s) have not synced to the mailing list',
      'detail', jsonb_build_object('count', n)));
  END IF;

  -- 11. Entry drift: entries ahead of months paid
  SELECT count(*) INTO n FROM public.members WHERE entries > months_active;
  IF n > 0 THEN
    issues := issues || jsonb_build_array(jsonb_build_object(
      'key', 'entry_drift', 'severity', 'warning',
      'title', n || ' member(s) have more giveaway entries than months active',
      'detail', jsonb_build_object('count', n)));
  END IF;

  RETURN jsonb_build_object('generated_at', now(), 'issues', issues);
END;
$function$;