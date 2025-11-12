-- =============================================
-- ADD BOOST REWARD MESSAGE
-- Adds automated DM message that gets sent when someone boosts a post
-- =============================================

-- Add boost_reward_message column to posts table
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS boost_reward_message TEXT;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_posts_boost_reward_message ON public.posts(boost_reward_message) WHERE boost_reward_message IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.posts.boost_reward_message IS 'Automated message that will be sent as a DM to users who boost this post. If set, a DM will be automatically sent when someone boosts the post.';

-- Function to get or create DM thread between two users
CREATE OR REPLACE FUNCTION public.get_or_create_dm_thread(
  p_user_a_id UUID,
  p_user_b_id UUID,
  p_initiated_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_thread_id UUID;
  v_user_a UUID;
  v_user_b UUID;
BEGIN
  -- Ensure deterministic ordering
  IF p_user_a_id < p_user_b_id THEN
    v_user_a := p_user_a_id;
    v_user_b := p_user_b_id;
  ELSE
    v_user_a := p_user_b_id;
    v_user_b := p_user_a_id;
  END IF;

  -- Try to get existing thread
  SELECT id INTO v_thread_id
  FROM public.dm_threads
  WHERE user_a_id = v_user_a
    AND user_b_id = v_user_b
  LIMIT 1;

  -- Create thread if it doesn't exist
  IF v_thread_id IS NULL THEN
    INSERT INTO public.dm_threads (user_a_id, user_b_id, initiated_by)
    VALUES (v_user_a, v_user_b, p_initiated_by)
    ON CONFLICT (LEAST(user_a_id, user_b_id), GREATEST(user_a_id, user_b_id)) DO NOTHING
    RETURNING id INTO v_thread_id;

    -- If still null (race condition), fetch it
    IF v_thread_id IS NULL THEN
      SELECT id INTO v_thread_id
      FROM public.dm_threads
      WHERE user_a_id = v_user_a
        AND user_b_id = v_user_b
      LIMIT 1;
    END IF;
  END IF;

  RETURN v_thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send boost reward message
CREATE OR REPLACE FUNCTION public.send_boost_reward_message(
  p_post_author_id UUID,
  p_booster_id UUID,
  p_message_content TEXT
)
RETURNS VOID AS $$
DECLARE
  v_thread_id UUID;
  v_message_id UUID;
BEGIN
  -- Skip if message is empty
  IF p_message_content IS NULL OR trim(p_message_content) = '' THEN
    RETURN;
  END IF;

  -- Get or create DM thread (initiated by post author)
  v_thread_id := public.get_or_create_dm_thread(
    p_post_author_id,
    p_booster_id,
    p_post_author_id
  );

  IF v_thread_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create or get DM thread';
  END IF;

  -- Wait a bit for participant creation (if thread was just created)
  PERFORM pg_sleep(0.1);

  -- Insert the automated message
  INSERT INTO public.dm_messages (
    thread_id,
    sender_id,
    message_type,
    content,
    metadata
  )
  VALUES (
    v_thread_id,
    p_post_author_id,
    'text',
    p_message_content,
    jsonb_build_object('boost_reward', true)
  )
  RETURNING id INTO v_message_id;

  -- Update participant status to active if it was pending (for new threads)
  UPDATE public.dm_participants
  SET status = 'active',
      request_resolved_at = COALESCE(request_resolved_at, NOW())
  WHERE thread_id = v_thread_id
    AND user_id = p_booster_id
    AND status = 'pending';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update boost_post function to send reward message
CREATE OR REPLACE FUNCTION public.boost_post(
  p_post_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_post_author_id UUID;
  v_user_balance BIGINT;
  v_boost_reward_message TEXT;
  v_result JSON;
BEGIN
  -- Get post author and boost reward message
  SELECT author_id, boost_reward_message INTO v_post_author_id, v_boost_reward_message
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

  -- Create transaction records
  INSERT INTO public.transactions (user_id, type, points_delta, recipient_user_id, created_at)
  VALUES 
    (p_user_id, 'point_spend', -1, v_post_author_id, NOW()),
    (v_post_author_id, 'point_refund', 1, NOW());

  -- Send boost reward message if configured
  IF v_boost_reward_message IS NOT NULL AND trim(v_boost_reward_message) != '' THEN
    BEGIN
      PERFORM public.send_boost_reward_message(
        v_post_author_id,
        p_user_id,
        v_boost_reward_message
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the boost
      RAISE WARNING 'Failed to send boost reward message: %', SQLERRM;
    END;
  END IF;

  v_result := json_build_object(
    'boosted', true,
    'message', 'Post boosted successfully'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

