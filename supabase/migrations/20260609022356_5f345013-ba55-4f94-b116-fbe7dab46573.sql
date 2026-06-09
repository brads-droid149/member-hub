ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE public.members ADD CONSTRAINT members_status_check CHECK (status IN ('active', 'past_due', 'cancelled'));