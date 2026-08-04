DROP POLICY IF EXISTS "Users can only join their own realtime channel" ON realtime.messages;

CREATE POLICY "Users can only join their own realtime channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'home-member-' || auth.uid()::text
  OR realtime.topic() = 'checkout-return-' || auth.uid()::text
  OR realtime.topic() = 'members-self-' || auth.uid()::text
);