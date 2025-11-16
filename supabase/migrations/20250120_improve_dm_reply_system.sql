-- =============================================
-- IMPROVE DM REPLY SYSTEM
-- Adds constraints, indexes, and validation for message replies
-- =============================================

-- Add index for efficient reply lookups
CREATE INDEX IF NOT EXISTS idx_dm_messages_reply_to_message_id 
ON public.dm_messages(reply_to_message_id) 
WHERE reply_to_message_id IS NOT NULL;

-- Add composite index for thread + reply lookups
CREATE INDEX IF NOT EXISTS idx_dm_messages_thread_reply 
ON public.dm_messages(thread_id, reply_to_message_id) 
WHERE reply_to_message_id IS NOT NULL;

-- Function to validate reply before insert/update
CREATE OR REPLACE FUNCTION public.validate_dm_reply()
RETURNS TRIGGER AS $$
BEGIN
  -- If no reply, allow
  IF NEW.reply_to_message_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check that replied message exists, is in same thread, and is not deleted
  IF NOT EXISTS (
    SELECT 1
    FROM public.dm_messages m
    WHERE m.id = NEW.reply_to_message_id
      AND m.thread_id = NEW.thread_id
      AND m.is_deleted = FALSE
  ) THEN
    RAISE EXCEPTION 'Replied message must exist in the same thread and not be deleted';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS validate_dm_reply_trigger ON public.dm_messages;
CREATE TRIGGER validate_dm_reply_trigger
  BEFORE INSERT OR UPDATE ON public.dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_dm_reply();

COMMENT ON FUNCTION public.validate_dm_reply()
  IS 'Validates that reply_to_message_id references a valid message in the same thread that is not deleted';

COMMENT ON INDEX idx_dm_messages_reply_to_message_id
  IS 'Index for efficient lookups of messages that are replies';

COMMENT ON INDEX idx_dm_messages_thread_reply
  IS 'Composite index for efficient lookups of replies within a thread';




