-- Fix toggle_post_like function to use correct column name
-- The wallets table uses 'points_balance', not 'balance'

CREATE OR REPLACE FUNCTION public.toggle_post_like(
  p_post_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_like_exists BOOLEAN;
  v_post_author_id UUID;
  v_user_balance BIGINT;
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
    SET points_balance = points_balance + 1
    WHERE user_id = p_user_id;

    -- Remove 1 point from post author
    UPDATE public.wallets
    SET points_balance = points_balance - 1
    WHERE user_id = v_post_author_id;

    -- Create transaction records
    INSERT INTO public.transactions (user_id, type, points_delta, created_at)
    VALUES 
      (p_user_id, 'point_refund', 1, NOW()),
      (v_post_author_id, 'point_spend', -1, NOW());

    v_result := json_build_object(
      'liked', false,
      'message', 'Post unliked successfully'
    );
  ELSE
    -- LIKE: Add like and transfer points
    
    -- Check if user has enough balance
    SELECT points_balance INTO v_user_balance
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
    SET points_balance = points_balance - 1
    WHERE user_id = p_user_id;

    -- Add 1 point to post author
    UPDATE public.wallets
    SET points_balance = points_balance + 1
    WHERE user_id = v_post_author_id;

    -- Create transaction records
    INSERT INTO public.transactions (user_id, type, points_delta, created_at)
    VALUES 
      (p_user_id, 'point_spend', -1, NOW()),
      (v_post_author_id, 'point_refund', 1, NOW());

    v_result := json_build_object(
      'liked', true,
      'message', 'Post liked successfully'
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;