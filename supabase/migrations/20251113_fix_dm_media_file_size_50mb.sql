-- Fix dm-media bucket file size limit to 50MB
-- This migration ensures the bucket allows 50MB files (Supabase free tier max)
-- Run this if you're getting "file too large" errors for files under 50MB

UPDATE storage.buckets
SET file_size_limit = 52428800 -- 50MB (52428800 bytes)
WHERE id = 'dm-media';

-- Verify the update
SELECT id, name, file_size_limit, 
       ROUND(file_size_limit / 1024.0 / 1024.0, 2) as file_size_limit_mb
FROM storage.buckets
WHERE id = 'dm-media';

