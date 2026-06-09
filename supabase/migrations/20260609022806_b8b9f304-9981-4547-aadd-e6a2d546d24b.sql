-- Drop existing broad authenticated-user read policies on giveaways, partners, and past_winners
DROP POLICY IF EXISTS "Authenticated users can view giveaways" ON public.giveaways;
DROP POLICY IF EXISTS "Authenticated users can view partners" ON public.partners;
DROP POLICY IF EXISTS "Authenticated users can view winners" ON public.past_winners;

-- Create new policies that restrict read access to active/past_due members and admins
CREATE POLICY "Active members can view giveaways"
ON public.giveaways FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.user_id = auth.uid()
    AND members.status IN ('active', 'past_due')
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Active members can view partners"
ON public.partners FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.user_id = auth.uid()
    AND members.status IN ('active', 'past_due')
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Active members can view winners"
ON public.past_winners FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE members.user_id = auth.uid()
    AND members.status IN ('active', 'past_due')
  )
  OR public.has_role(auth.uid(), 'admin')
);