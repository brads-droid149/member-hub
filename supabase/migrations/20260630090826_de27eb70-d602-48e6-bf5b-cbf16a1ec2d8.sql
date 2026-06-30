COMMENT ON COLUMN public.members.status IS
  'STATUS SPELLING SPLIT: uses AU spelling — allowed values: active, pending, past_due, cancelled (double-L). The payments-webhook edge function translates from Stripe US spelling. Do NOT normalise to US spelling without updating the webhook, ProtectedRoute, and admin UI together. See supabase/functions/_shared/stripe.ts header.';

COMMENT ON COLUMN public.subscriptions.status IS
  'STATUS SPELLING SPLIT: mirrors Stripe payload verbatim — US spelling (canceled, single-L; past_due; incomplete; etc.). Stripe is the source of truth. Do NOT remap to AU spelling here; members.status is the AU-facing field. See supabase/functions/_shared/stripe.ts header.';