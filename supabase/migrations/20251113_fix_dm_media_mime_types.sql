-- Fix dm-media bucket to accept all image formats including JPEG
-- This ensures JPEG files can be uploaded

-- First, ensure the bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dm-media',
  'dm-media',
  false,
  52428800, -- 50 MB (Supabase free tier max)
  ARRAY[
    -- Images - All major formats
    'image/jpeg',
    'image/jpg',
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
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 52428800, -- 50 MB (Supabase free tier max)
  allowed_mime_types = ARRAY[
    -- Images - All major formats (including both image/jpeg and image/jpg)
    'image/jpeg',
    'image/jpg',
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
  ];