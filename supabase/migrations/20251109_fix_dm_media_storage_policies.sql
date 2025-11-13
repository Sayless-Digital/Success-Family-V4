-- Fix storage policies for dm-media bucket
-- Allow authenticated users to read files (for viewing attachments in conversations)
-- Allow authenticated users to upload to their own folder

-- Drop existing policies if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'DM owners can upload media') THEN
    DROP POLICY "DM owners can upload media" ON storage.objects;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'DM owners can manage their media') THEN
    DROP POLICY "DM owners can manage their media" ON storage.objects;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'DM participants can read media') THEN
    DROP POLICY "DM participants can read media" ON storage.objects;
  END IF;
END $$;

-- Allow authenticated users to upload files to their own folder (user_id/...)
CREATE POLICY "DM owners can upload media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dm-media'
    AND (
      -- Allow uploads to user's own folder
      split_part(name, '/', 1) = auth.uid()::text
      -- Also allow if owner matches (for backward compatibility)
      OR auth.uid() = owner
    )
  );

-- Allow authenticated users to read files in dm-media bucket
-- Access is controlled at the application level (only thread participants can see messages)
CREATE POLICY "DM participants can read media"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'dm-media');

-- Allow users to manage (update/delete) their own files
CREATE POLICY "DM owners can manage their media"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'dm-media'
    AND (
      -- Allow if file is in user's folder
      split_part(name, '/', 1) = auth.uid()::text
      -- Also allow if owner matches (for backward compatibility)
      OR auth.uid() = owner
    )
  )
  WITH CHECK (
    bucket_id = 'dm-media'
    AND (
      -- Allow if file is in user's folder
      split_part(name, '/', 1) = auth.uid()::text
      -- Also allow if owner matches (for backward compatibility)
      OR auth.uid() = owner
    )
  );

