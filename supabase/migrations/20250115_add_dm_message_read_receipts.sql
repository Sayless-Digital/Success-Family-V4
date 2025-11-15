-- =============================================
-- MESSAGE READ RECEIPTS
-- Tracks which messages have been read by which users
-- =============================================

CREATE TABLE IF NOT EXISTS public.dm_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.dm_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

COMMENT ON TABLE public.dm_message_reads
  IS 'Tracks read receipts for direct messages. Each row indicates a user has read a specific message.';

CREATE INDEX IF NOT EXISTS idx_dm_message_reads_message_id ON public.dm_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_dm_message_reads_user_id ON public.dm_message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_dm_message_reads_read_at ON public.dm_message_reads(read_at DESC);

ALTER TABLE public.dm_message_reads ENABLE ROW LEVEL SECURITY;

-- Users can view read receipts for messages in threads they participate in
CREATE POLICY "Participants can view read receipts"
  ON public.dm_message_reads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.dm_messages m
      JOIN public.dm_threads t ON t.id = m.thread_id
      WHERE m.id = dm_message_reads.message_id
        AND (auth.uid() = t.user_a_id OR auth.uid() = t.user_b_id)
    )
  );

-- Users can insert read receipts for messages they can read
CREATE POLICY "Participants can mark messages as read"
  ON public.dm_message_reads
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.dm_messages m
      JOIN public.dm_threads t ON t.id = m.thread_id
      WHERE m.id = dm_message_reads.message_id
        AND (auth.uid() = t.user_a_id OR auth.uid() = t.user_b_id)
        AND m.sender_id <> auth.uid() -- Can only mark messages from others as read
    )
  );

-- Users can update their own read receipts (e.g., if read_at needs to be updated)
CREATE POLICY "Users can update their own read receipts"
  ON public.dm_message_reads
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to mark multiple messages as read efficiently
CREATE OR REPLACE FUNCTION public.mark_messages_as_read(
  p_thread_id UUID,
  p_user_id UUID,
  p_message_ids UUID[]
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Verify user is a participant in the thread
  IF NOT EXISTS (
    SELECT 1
    FROM public.dm_participants
    WHERE thread_id = p_thread_id
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User is not a participant in this thread';
  END IF;

  -- Insert read receipts for messages that:
  -- 1. Are in the specified thread
  -- 2. Were sent by someone other than the current user
  -- 3. Don't already have a read receipt
  INSERT INTO public.dm_message_reads (message_id, user_id, read_at)
  SELECT m.id, p_user_id, NOW()
  FROM public.dm_messages m
  WHERE m.thread_id = p_thread_id
    AND m.id = ANY(p_message_ids)
    AND m.sender_id <> p_user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.dm_message_reads r
      WHERE r.message_id = m.id
        AND r.user_id = p_user_id
    )
  ON CONFLICT (message_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Update participant's last_read_at timestamp
  UPDATE public.dm_participants
  SET last_read_at = NOW()
  WHERE thread_id = p_thread_id
    AND user_id = p_user_id;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.mark_messages_as_read
  IS 'Marks multiple messages in a thread as read by a user. Returns the number of messages marked as read.';

