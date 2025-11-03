-- =============================================
-- ADD RECIPIENT TRACKING TO TRANSACTIONS
-- Adds recipient_user_id to track who received points
-- =============================================

-- Add recipient_user_id column to transactions
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Create index for recipient lookups
CREATE INDEX IF NOT EXISTS idx_transactions_recipient_user_id ON public.transactions(recipient_user_id);

-- Update boost_post function to include recipient
CREATE OR REPLACE FUNCTION public.boost_post(
  p_post_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
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

  -- Check if user is boosting their own post
  IF v_post_author_id = p_user_id THEN
    RAISE EXCEPTION 'Cannot boost your own post';
  END IF;

  -- Check if boost already exists
  IF EXISTS (
    SELECT 1 FROM public.post_boosts
    WHERE post_id = p_post_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'You have already boosted this post';
  END IF;

  -- Check if user has enough balance
  SELECT points_balance INTO v_user_balance
  FROM public.wallets
  WHERE user_id = p_user_id;

  IF v_user_balance < 1 THEN
    RAISE EXCEPTION 'Insufficient balance to boost post';
  END IF;

  -- Add boost
  INSERT INTO public.post_boosts (post_id, user_id)
  VALUES (p_post_id, p_user_id);

  -- Deduct 1 point from booster
  UPDATE public.wallets
  SET points_balance = points_balance - 1
  WHERE user_id = p_user_id;

  -- Add 1 point to post author
  UPDATE public.wallets
  SET points_balance = points_balance + 1
  WHERE user_id = v_post_author_id;

  -- Create transaction records with recipient info
  INSERT INTO public.transactions (user_id, type, points_delta, recipient_user_id, created_at)
  VALUES 
    (p_user_id, 'point_spend', -1, v_post_author_id, NOW()),
    (v_post_author_id, 'point_refund', 1, NULL, NOW());

  v_result := json_build_object(
    'boosted', true,
    'message', 'Post boosted successfully'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update unboost_post function to include recipient
CREATE OR REPLACE FUNCTION public.unboost_post(
  p_post_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_post_author_id UUID;
  v_boost_created_at TIMESTAMPTZ;
  v_result JSON;
BEGIN
  -- Get post author
  SELECT author_id INTO v_post_author_id
  FROM public.posts
  WHERE id = p_post_id;

  IF v_post_author_id IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  -- Check if boost exists and get created_at
  SELECT created_at INTO v_boost_created_at
  FROM public.post_boosts
  WHERE post_id = p_post_id AND user_id = p_user_id;

  IF v_boost_created_at IS NULL THEN
    RAISE EXCEPTION 'You have not boosted this post';
  END IF;

  -- Check if boost is within 1 minute (60 seconds)
  IF (EXTRACT(EPOCH FROM (NOW() - v_boost_created_at))) > 60 THEN
    RAISE EXCEPTION 'Cannot unboost after 1 minute';
  END IF;

  -- Remove boost
  DELETE FROM public.post_boosts
  WHERE post_id = p_post_id AND user_id = p_user_id;

  -- Return 1 point to booster
  UPDATE public.wallets
  SET points_balance = points_balance + 1
  WHERE user_id = p_user_id;

  -- Remove 1 point from post author
  UPDATE public.wallets
  SET points_balance = points_balance - 1
  WHERE user_id = v_post_author_id;

  -- Create transaction records with recipient info
  INSERT INTO public.transactions (user_id, type, points_delta, recipient_user_id, created_at)
  VALUES 
    (p_user_id, 'point_refund', 1, NULL, NOW()),
    (v_post_author_id, 'point_spend', -1, p_user_id, NOW());

  v_result := json_build_object(
    'boosted', false,
    'message', 'Post unboosted successfully'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN public.transactions.recipient_user_id IS 'User who received points in this transaction (null = platform fee for point_spend transactions, or no recipient for other types)';

## Error Type
Console Error

## Error Message
Failed to create media record: invalid input value for enum media_type: "audio"


    at uploadMedia (file:///home/mercury/Documents/Projects/Success Family/.next/dev/static/chunks/src_d1439eca._.js?id=%255Bproject%255D%252Fsrc%252Fcomponents%252Finline-post-composer.tsx+%255Bapp-client%255D+%2528ecmascript%2529:365:23)
    at async handleCreate (file:///home/mercury/Documents/Projects/Success Family/.next/dev/static/chunks/src_d1439eca._.js?id=%255Bproject%255D%252Fsrc%252Fcomponents%252Finline-post-composer.tsx+%255Bapp-client%255D+%2528ecmascript%2529:400:17)

Next.js version: 16.0.0 (Turbopack)
