-- =============================================
-- ADD VIDEO TO DM ATTACHMENT TYPE ENUM
-- Add 'video' as a valid attachment type for direct messages
-- =============================================

-- Add 'video' to the existing enum type
ALTER TYPE public.dm_attachment_type ADD VALUE IF NOT EXISTS 'video';

COMMENT ON TYPE public.dm_attachment_type IS 'Attachment types for direct messages: image, audio, file, video';







