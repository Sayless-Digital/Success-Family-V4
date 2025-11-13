-- Add GIF support to dm-media bucket
-- Update allowed_mime_types to include image/gif

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'application/pdf'
]
WHERE id = 'dm-media';

