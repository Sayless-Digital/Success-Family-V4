-- =============================================
-- SAVED POSTS SYSTEM
-- Allows users to save/bookmark posts for later viewing
-- =============================================

-- Create saved_posts table
CREATE TABLE IF NOT EXISTS public.saved_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_saved_posts_post_id ON public.saved_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_user_id ON public.saved_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_created_at ON public.saved_posts(created_at DESC);

-- Enable RLS
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

-- Policies for saved_posts
CREATE POLICY "Users can view their own saved posts"
  ON public.saved_posts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save posts"
  ON public.saved_posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave their own saved posts"
  ON public.saved_posts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Helper function: Check if user saved post
CREATE OR REPLACE FUNCTION public.user_saved_post(p_post_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.saved_posts 
    WHERE post_id = p_post_id AND user_id = p_user_id
  );
$$ LANGUAGE sql STABLE;

-- Helper function: Toggle save status
CREATE OR REPLACE FUNCTION public.toggle_save_post(
  p_post_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_saved BOOLEAN;
  v_result JSON;
BEGIN
  -- Check if already saved
  SELECT EXISTS (
    SELECT 1 FROM public.saved_posts
    WHERE post_id = p_post_id AND user_id = p_user_id
  ) INTO v_saved;

  IF v_saved THEN
    -- Unsave
    DELETE FROM public.saved_posts
    WHERE post_id = p_post_id AND user_id = p_user_id;

    v_result := json_build_object(
      'saved', false,
      'message', 'Post unsaved successfully'
    );
  ELSE
    -- Save
    INSERT INTO public.saved_posts (post_id, user_id)
    VALUES (p_post_id, p_user_id);

    v_result := json_build_object(
      'saved', true,
      'message', 'Post saved successfully'
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.saved_posts IS 'Tracks posts saved/bookmarked by users for later viewing.';
COMMENT ON FUNCTION public.user_saved_post IS 'Check if a user has saved a specific post.';
COMMENT ON FUNCTION public.toggle_save_post IS 'Toggle save status for a post. Returns JSON with saved status and message.';

