CREATE POLICY "Users can insert own membership"
ON public.members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own membership"
ON public.members
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);