-- =============================================
-- ADD BOOST REWARD ATTACHMENTS
-- Adds support for attachments (images and documents) in boost reward messages
-- =============================================

-- Create boost_reward_attachments table
CREATE TABLE IF NOT EXISTS public.boost_reward_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'document')),
  storage_path TEXT NOT NULL, -- Path in Supabase storage
  file_name TEXT NOT NULL,
  file_size INTEGER, -- Size in bytes
  mime_type TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_boost_reward_attachments_post_id ON public.boost_reward_attachments(post_id);

-- Enable RLS
ALTER TABLE public.boost_reward_attachments ENABLE ROW LEVEL SECURITY;

-- Policies for boost reward attachments
CREATE POLICY "Anyone can view boost reward attachments for posts"
  ON public.boost_reward_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = boost_reward_attachments.post_id
    )
  );

CREATE POLICY "Post authors can manage their boost reward attachments"
  ON public.boost_reward_attachments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = boost_reward_attachments.post_id
        AND p.author_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = boost_reward_attachments.post_id
        AND p.author_id = auth.uid()
    )
  );

-- Add comment
COMMENT ON TABLE public.boost_reward_attachments IS 'Attachments (images and documents) that will be included in automated boost reward messages sent via DM.';

-- Update send_boost_reward_message function to accept attachments
CREATE OR REPLACE FUNCTION public.send_boost_reward_message(
  p_post_author_id UUID,
  p_booster_id UUID,
  p_message_content TEXT,
  p_attachment_ids UUID[] DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_thread_id UUID;
  v_message_id UUID;
  v_attachment_id UUID;
  v_attachment RECORD;
  v_has_attachments BOOLEAN;
BEGIN
  -- Skip if message is empty and no attachments
  IF (p_message_content IS NULL OR trim(p_message_content) = '') AND (p_attachment_ids IS NULL OR array_length(p_attachment_ids, 1) IS NULL) THEN
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

  -- Check if we have attachments
  v_has_attachments := (p_attachment_ids IS NOT NULL AND array_length(p_attachment_ids, 1) > 0);

  -- Insert the automated message
  INSERT INTO public.dm_messages (
    thread_id,
    sender_id,
    message_type,
    content,
    has_attachments,
    metadata
  )
  VALUES (
    v_thread_id,
    p_post_author_id,
    'text',
    COALESCE(p_message_content, ''),
    v_has_attachments,
    jsonb_build_object('boost_reward', true)
  )
  RETURNING id INTO v_message_id;

  -- Copy attachments to dm_message_media if any
  IF v_has_attachments THEN
    FOR v_attachment_id IN SELECT unnest(p_attachment_ids)
    LOOP
      -- Get attachment details
      SELECT 
        media_type,
        storage_path,
        file_name,
        file_size,
        mime_type
      INTO v_attachment
      FROM public.boost_reward_attachments
      WHERE id = v_attachment_id;

      IF v_attachment.media_type IS NOT NULL THEN
        -- Map media_type: 'image' -> 'image', 'document' -> 'file'
        INSERT INTO public.dm_message_media (
          message_id,
          media_type,
          storage_path,
          mime_type,
          file_size
        )
        VALUES (
          v_message_id,
          CASE 
            WHEN v_attachment.media_type = 'document' THEN 'file'::public.dm_attachment_type
            ELSE v_attachment.media_type::public.dm_attachment_type
          END,
          v_attachment.storage_path,
          v_attachment.mime_type,
          v_attachment.file_size
        );
      END IF;
    END LOOP;
  END IF;

  -- Update participant status to active if it was pending (for new threads)
  UPDATE public.dm_participants
  SET status = 'active',
      request_resolved_at = COALESCE(request_resolved_at, NOW())
  WHERE thread_id = v_thread_id
    AND user_id = p_booster_id
    AND status = 'pending';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update boost_post function to include attachments
CREATE OR REPLACE FUNCTION public.boost_post(
  p_post_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_post_author_id UUID;
  v_user_balance BIGINT;
  v_boost_reward_message TEXT;
  v_attachment_ids UUID[];
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

  -- Get attachment IDs for this post
  SELECT ARRAY_AGG(id) INTO v_attachment_ids
  FROM public.boost_reward_attachments
  WHERE post_id = p_post_id;

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
    (v_post_author_id, 'point_refund', 1, p_user_id, NOW());

  -- Send boost reward message if configured (message or attachments)
  IF (v_boost_reward_message IS NOT NULL AND trim(v_boost_reward_message) != '') OR 
     (v_attachment_ids IS NOT NULL AND array_length(v_attachment_ids, 1) > 0) THEN
    BEGIN
      PERFORM public.send_boost_reward_message(
        v_post_author_id,
        p_user_id,
        COALESCE(v_boost_reward_message, ''),
        v_attachment_ids
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

