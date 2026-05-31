DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'credit-monthly-entries') THEN
    PERFORM cron.unschedule('credit-monthly-entries');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cancel-stale-past-due-members') THEN
    PERFORM cron.unschedule('cancel-stale-past-due-members');
  END IF;
END $$;