-- =============================================
-- UPDATE DM THREAD PREVIEW TO USE [image] FOR IMAGES
-- Update triggers to distinguish between images and other attachments
-- =============================================

-- Update the insert trigger to check for image attachments
CREATE OR REPLACE FUNCTION public.sync_dm_thread_metadata()
RETURNS TRIGGER AS $$
DECLARE
  v_has_image BOOLEAN := false;
BEGIN
  -- Check if the message has image attachments
  SELECT EXISTS(
    SELECT 1
    FROM public.dm_message_media
    WHERE message_id = NEW.id
      AND media_type = 'image'
    LIMIT 1
  ) INTO v_has_image;

  UPDATE public.dm_threads
  SET
    last_message_at = NEW.created_at,
    last_message_preview = COALESCE(
      CASE
        WHEN NEW.message_type = 'text' AND NEW.content IS NOT NULL AND length(trim(NEW.content)) > 0
          THEN left(NEW.content, 240)
        WHEN NEW.message_type = 'system' THEN '[system]'
        WHEN v_has_image THEN '[image]'
        WHEN NEW.has_attachments THEN '[attachment]'
        ELSE NULL
      END,
      CASE
        WHEN v_has_image THEN '[image]'
        ELSE '[attachment]'
      END
    ),
    last_message_sender_id = NEW.sender_id,
    updated_at = NOW()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the delete trigger to check for image attachments
CREATE OR REPLACE FUNCTION public.sync_dm_thread_metadata_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_last_message public.dm_messages%ROWTYPE;
  v_has_image BOOLEAN := false;
BEGIN
  -- Find the new last message after this deletion
  SELECT * INTO v_last_message
  FROM public.dm_messages
  WHERE thread_id = OLD.thread_id
    AND id != OLD.id  -- Exclude the message being deleted
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Check if the last message has image attachments
    SELECT EXISTS(
      SELECT 1
      FROM public.dm_message_media
      WHERE message_id = v_last_message.id
        AND media_type = 'image'
      LIMIT 1
    ) INTO v_has_image;

    -- Update thread with the new last message info
    UPDATE public.dm_threads
    SET
      last_message_at = v_last_message.created_at,
      last_message_preview = COALESCE(
        CASE
          WHEN v_last_message.message_type = 'text' AND v_last_message.content IS NOT NULL AND length(trim(v_last_message.content)) > 0
            THEN left(v_last_message.content, 240)
          WHEN v_last_message.message_type = 'system' THEN '[system]'
          WHEN v_has_image THEN '[image]'
          ELSE NULL
        END,
        CASE
          WHEN v_has_image THEN '[image]'
          ELSE '[attachment]'
        END
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

COMMENT ON FUNCTION public.sync_dm_thread_metadata()
  IS 'Updates thread preview when a message is inserted, using [image] for image attachments';
COMMENT ON FUNCTION public.sync_dm_thread_metadata_on_delete()
  IS 'Updates thread preview when a message is deleted to show the actual current last message, using [image] for image attachments';




