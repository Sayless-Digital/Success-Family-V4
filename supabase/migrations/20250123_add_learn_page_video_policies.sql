-- =============================================
-- LEARN PAGE VIDEO RLS POLICIES
-- Adds policies for admins to manage learn page videos
-- =============================================

-- Allow admins to view learn page videos
CREATE POLICY "Admins can view learn page videos"
  ON public.uploaded_videos
  FOR SELECT
  TO authenticated
  USING (
    is_learn_page_video = true AND
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- Allow admins to insert learn page videos
CREATE POLICY "Admins can insert learn page videos"
  ON public.uploaded_videos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_learn_page_video = true AND
    community_id IS NULL AND
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- Allow admins to update learn page videos they uploaded
CREATE POLICY "Admins can update learn page videos"
  ON public.uploaded_videos
  FOR UPDATE
  TO authenticated
  USING (
    is_learn_page_video = true AND
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  )
  WITH CHECK (
    is_learn_page_video = true AND
    community_id IS NULL AND
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- Allow admins to delete learn page videos they uploaded
CREATE POLICY "Admins can delete learn page videos"
  ON public.uploaded_videos
  FOR DELETE
  TO authenticated
  USING (
    is_learn_page_video = true AND
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- Allow public to view learn page videos (for the learn page itself)
CREATE POLICY "Public can view learn page videos"
  ON public.uploaded_videos
  FOR SELECT
  TO public
  USING (is_learn_page_video = true);




