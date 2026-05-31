-- Fix legacy US spelling → AU spelling
UPDATE public.members
SET status = 'cancelled'
WHERE status = 'canceled';

-- Add CHECK constraint to restrict status to known valid values
ALTER TABLE public.members
ADD CONSTRAINT members_status_check
CHECK (status IN ('active', 'past_due', 'cancelled', 'paused'));