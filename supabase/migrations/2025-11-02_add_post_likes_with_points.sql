-- =============================================
-- POST LIKES SYSTEM WITH POINT TRANSFERS
-- =============================================

-- Create post_likes table
CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);

-- Enable RLS
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- Policies for post_likes
CREATE POLICY "Anyone can view likes"
  ON public.post_likes
  FOR SELECT
  USING (true);

CREATE POLICY "Users can like posts"
  ON public.post_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike their own likes"
  ON public.post_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- FUNCTION: Toggle Like with Point Transfer
-- =============================================

CREATE OR REPLACE FUNCTION public.toggle_post_like(
  p_post_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_like_exists BOOLEAN;
  v_post_author_id UUID;
  v_user_balance INTEGER;
  v_result JSON;
BEGIN
  -- Get post author
  SELECT author_id INTO v_post_author_id
  FROM public.posts
  WHERE id = p_post_id;

  IF v_post_author_id IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  -- Check if user is liking their own post
  IF v_post_author_id = p_user_id THEN
    RAISE EXCEPTION 'Cannot like your own post';
  END IF;

  -- Check if like already exists
  SELECT EXISTS (
    SELECT 1 FROM public.post_likes
    WHERE post_id = p_post_id AND user_id = p_user_id
  ) INTO v_like_exists;

  IF v_like_exists THEN
    -- UNLIKE: Remove like and reverse point transfer
    DELETE FROM public.post_likes
    WHERE post_id = p_post_id AND user_id = p_user_id;

    -- Return 1 point to liker
    UPDATE public.wallets
    SET balance = balance + 1
    WHERE user_id = p_user_id;

    -- Remove 1 point from post author
    UPDATE public.wallets
    SET balance = balance - 1
    WHERE user_id = v_post_author_id;

    -- Create transaction records
    INSERT INTO public.transactions (user_id, type, amount, description, status)
    VALUES 
      (p_user_id, 'credit', 1, 'Unlike refund', 'completed'),
      (v_post_author_id, 'debit', 1, 'Unlike penalty', 'completed');

    v_result := json_build_object(
      'liked', false,
      'message', 'Post unliked successfully'
    );
  ELSE
    -- LIKE: Add like and transfer points
    
    -- Check if user has enough balance
    SELECT balance INTO v_user_balance
    FROM public.wallets
    WHERE user_id = p_user_id;

    IF v_user_balance < 1 THEN
      RAISE EXCEPTION 'Insufficient balance to like post';
    END IF;

    -- Add like
    INSERT INTO public.post_likes (post_id, user_id)
    VALUES (p_post_id, p_user_id);

    -- Deduct 1 point from liker
    UPDATE public.wallets
    SET balance = balance - 1
    WHERE user_id = p_user_id;

    -- Add 1 point to post author
    UPDATE public.wallets
    SET balance = balance + 1
    WHERE user_id = v_post_author_id;

    -- Create transaction records
    INSERT INTO public.transactions (user_id, type, amount, description, status)
    VALUES 
      (p_user_id, 'debit', 1, 'Liked post', 'completed'),
      (v_post_author_id, 'credit', 1, 'Post liked', 'completed');

    v_result := json_build_object(
      'liked', true,
      'message', 'Post liked successfully'
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FUNCTION: Get Like Count for Post
-- =============================================

CREATE OR REPLACE FUNCTION public.get_post_like_count(p_post_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM public.post_likes WHERE post_id = p_post_id;
$$ LANGUAGE sql STABLE;

-- =============================================
-- FUNCTION: Check if User Liked Post
-- =============================================

CREATE OR REPLACE FUNCTION public.user_liked_post(p_post_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.post_likes 
    WHERE post_id = p_post_id AND user_id = p_user_id
  );
$$ LANGUAGE sql STABLE;