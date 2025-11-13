-- Add missing INSERT policy for dm-media bucket
-- This was the critical missing piece that prevented ALL file uploads (PNG, JPEG, etc.)
-- Without an INSERT policy, users cannot upload any files to the storage bucket

-- Drop any conflicting policies first
DROP POLICY IF EXISTS "Users can upload to dm-media" ON storage.objects;
DROP POLICY IF EXISTS "DM owners can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload dm-media" ON storage.objects;

-- Create INSERT policy to allow authenticated users to upload files
-- Users can only upload files where they are the owner
CREATE POLICY "Authenticated users can upload dm-media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dm-media'
    AND auth.uid() = owner
  );