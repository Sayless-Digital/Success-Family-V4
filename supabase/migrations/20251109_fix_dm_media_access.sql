-- =============================================
-- FIX DM MEDIA ACCESS PERMISSIONS
-- Allow thread participants to view each other's media
-- =============================================

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "DM owners can manage their media" ON storage.objects;

-- Allow users to read media from their DM threads
CREATE POLICY "Thread participants can view DM media"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'dm-media'
    AND (
      -- User is the owner
      auth.uid() = owner
      OR
      -- User is in a thread with the owner
      EXISTS (
        SELECT 1
        FROM public.dm_threads t
        WHERE (t.user_a_id = auth.uid() OR t.user_b_id = auth.uid())
          AND (t.user_a_id = owner OR t.user_b_id = owner)
      )
    )
  );

-- Allow users to update/delete only their own media
CREATE POLICY "DM owners can manage their own media"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'dm-media' AND auth.uid() = owner)
  WITH CHECK (bucket_id = 'dm-media' AND auth.uid() = owner);

CREATE POLICY "DM owners can delete their own media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'dm-media' AND auth.uid() = owner);