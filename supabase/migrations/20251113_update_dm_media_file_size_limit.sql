-- Update dm-media bucket file size limit to 50MB (Supabase free tier max)
-- This allows videos to be up to 50MB while other files can still be validated at 25MB on the client side

UPDATE storage.buckets
SET file_size_limit = 52428800 -- 50MB (52428800 bytes)
WHERE id = 'dm-media';

COMMENT ON COLUMN storage.buckets.file_size_limit IS 'Updated dm-media bucket to allow up to 50MB files (Supabase free tier maximum)';














