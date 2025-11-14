-- =============================================
-- ADD FILE_NAME COLUMN TO DM_MESSAGE_MEDIA
-- Store original file names for file attachments
-- =============================================

-- Add file_name column to store original file names
ALTER TABLE public.dm_message_media
ADD COLUMN IF NOT EXISTS file_name TEXT;

COMMENT ON COLUMN public.dm_message_media.file_name IS 'Original file name as uploaded by the user';

