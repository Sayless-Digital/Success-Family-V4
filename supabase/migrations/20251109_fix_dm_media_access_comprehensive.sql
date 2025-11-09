-- =============================================
-- COMPREHENSIVE FIX FOR DM MEDIA ACCESS
-- Allows thread participants to view each other's media
-- =============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Thread participants can view DM media" ON storage.objects;
DROP POLICY IF EXISTS "DM owners can manage their own media" ON storage.objects;
DROP POLICY IF EXISTS "DM owners can delete their own media" ON storage.objects;

-- Allow thread participants to SELECT (view/download/create signed URLs) dm-media objects
CREATE POLICY "Thread participants can view dm-media"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'dm-media'
    AND (
      -- User is the owner of the file
      auth.uid() = owner
      OR
      -- User is in a thread with the file owner
      EXISTS (
        SELECT 1
        FROM public.dm_threads t
        WHERE (t.user_a_id = auth.uid() OR t.user_b_id = auth.uid())
          AND (t.user_a_id = owner OR t.user_b_id = owner)
      )
    )
  );

-- Allow owners to UPDATE their own media
CREATE POLICY "Owners can update their own dm-media"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'dm-media'
    AND auth.uid() = owner
  )
  WITH CHECK (
    bucket_id = 'dm-media'
    AND auth.uid() = owner
  );

-- Allow owners to DELETE their own media
CREATE POLICY "Owners can delete their own dm-media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'dm-media'
    AND auth.uid() = owner
  );