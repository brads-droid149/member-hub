-- Retire the alert-pipeline test noise so system_health_snapshot() stops
-- counting it. Records are kept for history under a non-alerting status.
UPDATE public.email_send_log
SET status = 'suppressed',
    error_message = coalesce(error_message, '') || ' [retired: alert-pipeline test, idempotency-key retry bug]'
WHERE template_name = 'admin-system-alert'
  AND status IN ('failed', 'dlq')
  AND created_at < now();

-- Stale "pending" rows with no later terminal row for the same message.
UPDATE public.email_send_log l
SET status = 'suppressed'
WHERE l.template_name = 'admin-system-alert'
  AND l.status = 'pending'
  AND l.created_at < now() - interval '15 minutes'
  AND NOT EXISTS (
    SELECT 1 FROM public.email_send_log l2
    WHERE l2.message_id = l.message_id
      AND l2.status = 'sent'
  );

-- Drop the dead-lettered test alert emails.
DELETE FROM pgmq.q_transactional_emails_dlq;
