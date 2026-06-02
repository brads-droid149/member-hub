-- Fix H-06: Add indexes on members.status and members.last_entry_credited_at
-- The credit_monthly_entries() function runs daily and filters by both columns.
-- Without indexes, every run does a full table scan — fine now, painful at scale.

CREATE INDEX IF NOT EXISTS idx_members_status ON public.members(status);

CREATE INDEX IF NOT EXISTS idx_members_last_credited ON public.members(last_entry_credited_at) WHERE status = 'active';