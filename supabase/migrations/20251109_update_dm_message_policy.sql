-- =============================================
-- UPDATE DM MESSAGE INSERT POLICY
-- Restrict message sending to active participants only
-- =============================================

DROP POLICY IF EXISTS "Participants can insert messages" ON public.dm_messages;

CREATE POLICY "Participants can insert messages"
  ON public.dm_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.dm_threads t
      JOIN public.dm_participants p
        ON p.thread_id = t.id
       AND p.user_id = auth.uid()
      WHERE t.id = dm_messages.thread_id
        AND dm_messages.sender_id = auth.uid()
        AND p.status = 'active'
    )
  );



















