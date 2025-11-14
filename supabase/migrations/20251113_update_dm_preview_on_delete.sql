-- =============================================
-- UPDATE DM THREAD PREVIEW ON MESSAGE DELETE
-- When a message is deleted, update the thread's last_message_preview
-- to show the actual current last message
-- =============================================

-- Trigger to update thread metadata when a message is deleted
CREATE OR REPLACE FUNCTION public.sync_dm_thread_metadata_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_last_message public.dm_messages%ROWTYPE;
BEGIN
  -- Find the new last message after this deletion
  SELECT * INTO v_last_message
  FROM public.dm_messages
  WHERE thread_id = OLD.thread_id
    AND id != OLD.id  -- Exclude the message being deleted
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Update thread with the new last message info
    UPDATE public.dm_threads
    SET
      last_message_at = v_last_message.created_at,
      last_message_preview = COALESCE(
        CASE
          WHEN v_last_message.message_type = 'text' THEN left(COALESCE(v_last_message.content, ''), 240)
          WHEN v_last_message.message_type = 'system' THEN '[system]'
          ELSE NULL
        END,
        '[attachment]'
      ),
      last_message_sender_id = v_last_message.sender_id,
      updated_at = NOW()
    WHERE id = OLD.thread_id;
  ELSE
    -- No messages left in thread - clear the preview
    UPDATE public.dm_threads
    SET
      last_message_at = NULL,
      last_message_preview = NULL,
      last_message_sender_id = NULL,
      updated_at = NOW()
    WHERE id = OLD.thread_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for delete operations
DROP TRIGGER IF EXISTS sync_dm_thread_metadata_on_delete_trigger ON public.dm_messages;
CREATE TRIGGER sync_dm_thread_metadata_on_delete_trigger
  AFTER DELETE ON public.dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_dm_thread_metadata_on_delete();

-- Also update the existing insert trigger to handle attachments better
CREATE OR REPLACE FUNCTION public.sync_dm_thread_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.dm_threads
  SET
    last_message_at = NEW.created_at,
    last_message_preview = COALESCE(
      CASE
        WHEN NEW.message_type = 'text' AND NEW.content IS NOT NULL AND length(trim(NEW.content)) > 0
          THEN left(NEW.content, 240)
        WHEN NEW.message_type = 'system' THEN '[system]'
        WHEN NEW.has_attachments THEN '[attachment]'
        ELSE NULL
      END,
      '[attachment]'
    ),
    last_message_sender_id = NEW.sender_id,
    updated_at = NOW()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.sync_dm_thread_metadata_on_delete()
  IS 'Updates thread preview when a message is deleted to show the actual current last message';