-- Add all major image formats to dm-media bucket
-- Update allowed_mime_types to include all commonly used image formats

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
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
  -- Documents
  'application/pdf'
]
WHERE id = 'dm-media';









