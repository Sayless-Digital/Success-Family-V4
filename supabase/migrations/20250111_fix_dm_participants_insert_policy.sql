-- =============================================
-- Fix DM participants insert policy to allow trigger function inserts
-- The SECURITY DEFINER trigger function needs to insert participants,
-- but RLS blocks it because auth.uid() is NULL in that context.
-- =============================================

DROP POLICY IF EXISTS "Participants can insert membership rows" ON public.dm_participants;

-- Allow inserts if:
-- 1. The user is inserting their own participant row, OR
-- 2. The user is the thread initiator inserting for the other participant, OR
-- 3. The user_id being inserted matches one of the thread's participants (for trigger function)
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
        AND (
          t.initiated_by = auth.uid() OR
          t.user_a_id = dm_participants.user_id OR
          t.user_b_id = dm_participants.user_id
        )
    )
  );

-- Additionally, we need to allow the trigger function (running as SECURITY DEFINER)
-- to bypass RLS. Since SECURITY DEFINER functions run with the function owner's
-- privileges, we need to ensure the function owner has the right to insert.
-- However, Supabase's RLS still applies even to SECURITY DEFINER functions.
-- The solution is to also allow inserts when the thread exists and the user_id
-- matches one of the thread participants, which we've already done above.

-- But wait, if auth.uid() is NULL in the trigger function, the policy won't match.
-- We need a different approach: allow inserts when the user_id is in the thread.
-- Actually, the policy above should work if we check the thread participants directly.

-- Let's create a more permissive policy that checks thread membership:
DROP POLICY IF EXISTS "Participants can insert membership rows" ON public.dm_participants;

CREATE POLICY "Participants can insert membership rows"
  ON public.dm_participants
  FOR INSERT
  WITH CHECK (
    -- Allow if user is inserting themselves
    auth.uid() = user_id OR
    -- Allow if user is thread initiator
    EXISTS (
      SELECT 1
      FROM public.dm_threads t
      WHERE t.id = dm_participants.thread_id
        AND t.initiated_by = auth.uid()
    ) OR
    -- Allow if the user_id being inserted is a valid thread participant
    -- This allows the trigger function to work even when auth.uid() is NULL
    EXISTS (
      SELECT 1
      FROM public.dm_threads t
      WHERE t.id = dm_participants.thread_id
        AND (t.user_a_id = dm_participants.user_id OR t.user_b_id = dm_participants.user_id)
    )
  );











