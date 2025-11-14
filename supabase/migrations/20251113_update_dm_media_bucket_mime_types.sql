-- =============================================
-- UPDATE DM MEDIA BUCKET TO SUPPORT VIDEOS AND DOCUMENTS
-- Add video and document MIME types to the dm-media storage bucket
-- =============================================

-- Update the dm-media bucket to include video and document MIME types
-- Also ensure file size limit is 50MB (Supabase free tier max)
UPDATE storage.buckets
SET 
  allowed_mime_types = ARRAY[
  -- Images - All major formats
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/svg+xml',
  'image/tiff',
  'image/x-icon',
  'image/ico',
  'image/heic',
  'image/heif',
  'image/avif',
  -- Audio
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/wav',
  'audio/aac',
  'audio/flac',
  'audio/opus',
  -- Videos
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/x-m4v',
  -- Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/rtf'
],
  file_size_limit = 52428800 -- 50MB (Supabase free tier max)
WHERE id = 'dm-media';

COMMENT ON TABLE storage.buckets IS 'Updated dm-media bucket to support images, audio, videos, and documents';


