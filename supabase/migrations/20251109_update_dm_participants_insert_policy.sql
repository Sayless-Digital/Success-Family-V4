-- =============================================
-- Allow thread initiators to insert participant rows
-- =============================================

DROP POLICY IF EXISTS "Participants can insert membership rows" ON public.dm_participants;

CREATE POLICY "Participants can insert membership rows"
  ON public.dm_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1
      FROM public.dm_threads t
      WHERE t.id = dm_participants.thread_id
        AND t.initiated_by = auth.uid()
    )
  );











