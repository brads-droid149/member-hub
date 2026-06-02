-- Fix H-05: Restrict giveaways, partners, and past_winners to authenticated users only
-- These tables were readable by anyone with the anon key (unauthenticated internet users).
-- Winner names and states are PII; giveaway/partner data should only be visible to logged-in members.

-- 1. giveaways
DROP POLICY IF EXISTS "Anyone can view giveaways" ON public.giveaways;
CREATE POLICY "Authenticated users can view giveaways"
ON public.giveaways
FOR SELECT
TO authenticated
USING (true);

-- 2. partners
DROP POLICY IF EXISTS "Anyone can view partners" ON public.partners;
CREATE POLICY "Authenticated users can view partners"
ON public.partners
FOR SELECT
TO authenticated
USING (true);

-- 3. past_winners
DROP POLICY IF EXISTS "Anyone can view winners" ON public.past_winners;
CREATE POLICY "Authenticated users can view winners"
ON public.past_winners
FOR SELECT
TO authenticated
USING (true);