-- Compound index for subscriptions queried by user_id + environment
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_env
  ON public.subscriptions(user_id, environment);

-- Partial index for active giveaways only
CREATE INDEX IF NOT EXISTS idx_giveaways_active
  ON public.giveaways(is_active) WHERE is_active = true;