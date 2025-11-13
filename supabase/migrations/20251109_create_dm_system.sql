-- =============================================
-- DIRECT MESSAGING SYSTEM
-- Sets up one-to-one conversations, messages, attachments, and realtime hooks
-- =============================================

-- Participant status enum for DM membership
DO $$
BEGIN
  CREATE TYPE public.dm_participant_status AS ENUM ('pending', 'active', 'blocked', 'archived');
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- Message type enum
DO $$
BEGIN
  CREATE TYPE public.dm_message_type AS ENUM ('text', 'system');
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- Attachment type enum
DO $$
BEGIN
  CREATE TYPE public.dm_attachment_type AS ENUM ('image', 'audio', 'file');
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- =============================================
-- THREADS
-- =============================================

CREATE TABLE IF NOT EXISTS public.dm_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  initiated_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  last_message_sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  request_required BOOLEAN NOT NULL DEFAULT FALSE,
  request_resolved_at TIMESTAMPTZ,
  CHECK (user_a_id <> user_b_id),
  CHECK (initiated_by = user_a_id OR initiated_by = user_b_id)
);

COMMENT ON TABLE public.dm_threads
  IS 'Direct message threads between two users. user_a/user_b ordering is deterministic for uniqueness.';

-- Ensure user pair uniqueness regardless of ordering
CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_threads_unique_pair
ON public.dm_threads (LEAST(user_a_id, user_b_id), GREATEST(user_a_id, user_b_id));

CREATE INDEX IF NOT EXISTS idx_dm_threads_last_message_at ON public.dm_threads(last_message_at DESC NULLS LAST);

ALTER TABLE public.dm_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view threads"
  ON public.dm_threads
  FOR SELECT
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY "Participants can insert threads"
  ON public.dm_threads
  FOR INSERT
  WITH CHECK (
    (auth.uid() = user_a_id OR auth.uid() = user_b_id)
    AND auth.uid() = initiated_by
    AND user_a_id <> user_b_id
  );

CREATE POLICY "Participants can update threads"
  ON public.dm_threads
  FOR UPDATE
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id)
  WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

COMMENT ON COLUMN public.dm_threads.request_required
  IS 'Indicates if a message request must be accepted before messages are delivered.';

-- Determine whether a request is required based on follow state
CREATE OR REPLACE FUNCTION public.set_dm_request_flag()
RETURNS TRIGGER AS $$
DECLARE
  a_follows_b BOOLEAN;
  b_follows_a BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_follows
    WHERE follower_id = NEW.user_a_id
      AND followed_id = NEW.user_b_id
  ) INTO a_follows_b;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_follows
    WHERE follower_id = NEW.user_b_id
      AND followed_id = NEW.user_a_id
  ) INTO b_follows_a;

  NEW.request_required := NOT (a_follows_b AND b_follows_a);

  IF NOT NEW.request_required THEN
    NEW.request_resolved_at := COALESCE(NEW.request_resolved_at, NOW());
  ELSE
    NEW.request_resolved_at := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS set_dm_request_flag_trigger ON public.dm_threads;
CREATE TRIGGER set_dm_request_flag_trigger
  BEFORE INSERT ON public.dm_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_dm_request_flag();

-- Trigger to prevent participant mutation after insert
CREATE OR REPLACE FUNCTION public.prevent_dm_thread_participant_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_a_id <> OLD.user_a_id OR NEW.user_b_id <> OLD.user_b_id THEN
    RAISE EXCEPTION 'DM thread participants cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_dm_thread_participant_change_trigger ON public.dm_threads;
CREATE TRIGGER prevent_dm_thread_participant_change_trigger
  BEFORE UPDATE ON public.dm_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_dm_thread_participant_change();

DROP TRIGGER IF EXISTS update_dm_threads_updated_at ON public.dm_threads;
CREATE TRIGGER update_dm_threads_updated_at
  BEFORE UPDATE ON public.dm_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Automatically create participant rows for both users
CREATE OR REPLACE FUNCTION public.initialize_dm_participants()
RETURNS TRIGGER AS $$
DECLARE
  other_user UUID;
  initiator_status public.dm_participant_status := 'active';
  recipient_status public.dm_participant_status := 'active';
BEGIN
  IF NEW.initiated_by = NEW.user_a_id THEN
    other_user := NEW.user_b_id;
  ELSE
    other_user := NEW.user_a_id;
  END IF;

  IF NEW.request_required THEN
    recipient_status := 'pending';
  END IF;

  INSERT INTO public.dm_participants (thread_id, user_id, status, last_seen_at, last_read_at)
  VALUES (NEW.id, NEW.initiated_by, initiator_status, NOW(), NOW())
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO public.dm_participants (thread_id, user_id, status)
  VALUES (NEW.id, other_user, recipient_status)
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  IF NOT NEW.request_required AND NEW.request_resolved_at IS NULL THEN
    UPDATE public.dm_threads
    SET request_resolved_at = NOW()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS initialize_dm_participants_trigger ON public.dm_threads;
CREATE TRIGGER initialize_dm_participants_trigger
  AFTER INSERT ON public.dm_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_dm_participants();

-- =============================================
-- PARTICIPANTS
-- =============================================

CREATE TABLE IF NOT EXISTS public.dm_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status public.dm_participant_status NOT NULL DEFAULT 'active',
  last_seen_at TIMESTAMPTZ,
  last_read_at TIMESTAMPTZ,
  muted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (thread_id, user_id)
);

COMMENT ON TABLE public.dm_participants
  IS 'Per-user metadata for direct message participation (status, read state, mute state).';

ALTER TABLE public.dm_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their own dm_participants rows"
  ON public.dm_participants
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Participants can insert membership rows"
  ON public.dm_participants
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Participants manage their membership metadata"
  ON public.dm_participants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Participants can leave threads"
  ON public.dm_participants
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_dm_participants_user_id ON public.dm_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_dm_participants_thread_id ON public.dm_participants(thread_id);

DROP TRIGGER IF EXISTS update_dm_participants_updated_at ON public.dm_participants;
CREATE TRIGGER update_dm_participants_updated_at
  BEFORE UPDATE ON public.dm_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure participant belongs to the thread pair
CREATE OR REPLACE FUNCTION public.validate_dm_participant_membership()
RETURNS TRIGGER AS $$
DECLARE
  v_thread public.dm_threads%ROWTYPE;
BEGIN
  SELECT * INTO v_thread FROM public.dm_threads WHERE id = NEW.thread_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thread not found for participant';
  END IF;

  IF NEW.user_id <> v_thread.user_a_id AND NEW.user_id <> v_thread.user_b_id THEN
    RAISE EXCEPTION 'Participant must match one of the thread users';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_dm_participant_membership_trigger ON public.dm_participants;
CREATE TRIGGER validate_dm_participant_membership_trigger
  BEFORE INSERT OR UPDATE ON public.dm_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_dm_participant_membership();

-- =============================================
-- MESSAGES
-- =============================================

CREATE TABLE IF NOT EXISTS public.dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message_type public.dm_message_type NOT NULL DEFAULT 'text',
  content TEXT,
  metadata JSONB,
  has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
  reply_to_message_id UUID REFERENCES public.dm_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT dm_messages_content_required CHECK (
    (message_type = 'text' AND (has_attachments OR content IS NOT NULL AND length(trim(content)) > 0))
    OR
    (message_type = 'system')
  )
);

COMMENT ON TABLE public.dm_messages
  IS 'Messages exchanged in direct message threads. Supports text, system notices, and attachments.';

ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Thread participants can read messages"
  ON public.dm_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.dm_threads t
      WHERE t.id = dm_messages.thread_id
        AND (auth.uid() = t.user_a_id OR auth.uid() = t.user_b_id)
    )
  );

CREATE POLICY "Participants can insert messages"
  ON public.dm_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.dm_threads t
      JOIN public.dm_participants p ON p.thread_id = t.id AND p.user_id = auth.uid()
      WHERE t.id = dm_messages.thread_id
        AND dm_messages.sender_id = auth.uid()
        AND p.status IN ('active', 'pending')
    )
  );

CREATE POLICY "Participants can update their messages"
  ON public.dm_messages
  FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Participants can soft delete their messages"
  ON public.dm_messages
  FOR DELETE
  USING (sender_id = auth.uid());

-- Allow participants to delete threads with no messages (after message table exists)
CREATE POLICY "Participants can delete empty threads"
  ON public.dm_threads
  FOR DELETE
  USING (
    (auth.uid() = user_a_id OR auth.uid() = user_b_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.dm_messages m
      WHERE m.thread_id = dm_threads.id
    )
  );

CREATE INDEX IF NOT EXISTS idx_dm_messages_thread_created_at ON public.dm_messages(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_messages_sender_id ON public.dm_messages(sender_id, created_at DESC);

DROP TRIGGER IF EXISTS update_dm_messages_updated_at ON public.dm_messages;
CREATE TRIGGER update_dm_messages_updated_at
  BEFORE UPDATE ON public.dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to keep thread metadata up to date
CREATE OR REPLACE FUNCTION public.sync_dm_thread_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.dm_threads
  SET
    last_message_at = NEW.created_at,
    last_message_preview = COALESCE(
      CASE
        WHEN NEW.message_type = 'text' THEN left(COALESCE(NEW.content, ''), 240)
        WHEN NEW.message_type = 'system' THEN '[system]'
        ELSE NULL
      END,
      '[attachment]'
    ),
    last_message_sender_id = NEW.sender_id,
    updated_at = NOW()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_dm_thread_metadata_trigger ON public.dm_messages;
CREATE TRIGGER sync_dm_thread_metadata_trigger
  AFTER INSERT ON public.dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_dm_thread_metadata();

-- =============================================
-- MESSAGE ATTACHMENTS
-- =============================================

CREATE TABLE IF NOT EXISTS public.dm_message_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.dm_messages(id) ON DELETE CASCADE,
  media_type public.dm_attachment_type NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.dm_message_media
  IS 'Attachments associated with direct messages (images, voice notes, files).';

ALTER TABLE public.dm_message_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view message attachments"
  ON public.dm_message_media
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.dm_messages m
      JOIN public.dm_threads t ON t.id = m.thread_id
      WHERE m.id = dm_message_media.message_id
        AND (auth.uid() = t.user_a_id OR auth.uid() = t.user_b_id)
    )
  );

CREATE POLICY "Participants can insert attachments"
  ON public.dm_message_media
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.dm_messages m
      WHERE m.id = dm_message_media.message_id
        AND m.sender_id = auth.uid()
    )
  );

CREATE POLICY "Senders manage their attachments"
  ON public.dm_message_media
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.dm_messages m
      WHERE m.id = dm_message_media.message_id
        AND m.sender_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.dm_messages m
      WHERE m.id = dm_message_media.message_id
        AND m.sender_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_dm_message_media_message_id ON public.dm_message_media(message_id);

-- =============================================
-- CONVERSATION SUMMARY VIEW
-- =============================================

CREATE OR REPLACE VIEW public.dm_conversation_summaries AS
SELECT
  t.id AS thread_id,
  t.user_a_id,
  t.user_b_id,
  t.initiated_by,
  t.request_required,
  t.request_resolved_at,
  t.last_message_at,
  t.last_message_preview,
  t.last_message_sender_id,
  t.updated_at,
  p.user_id,
  p.status AS participant_status,
  p.last_read_at,
  p.last_seen_at,
  p.muted_at,
  CASE
    WHEN p.user_id = t.user_a_id THEN t.user_b_id
    ELSE t.user_a_id
  END AS other_user_id
FROM public.dm_threads t
JOIN public.dm_participants p ON p.thread_id = t.id;

GRANT SELECT ON public.dm_conversation_summaries TO authenticated;

COMMENT ON VIEW public.dm_conversation_summaries
  IS 'Flattened view of DM threads scoped per participant for sidebar rendering.';

-- =============================================
-- STORAGE BUCKET FOR DM MEDIA
-- =============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dm-media',
  'dm-media',
  false,
  26214400, -- 25 MB
  ARRAY[
    -- Images - All major formats
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/svg+xml',
    'image/tiff',
    'image/x-icon',
    'image/ico',
    'image/heic',
    'image/heif',
    'image/avif',
    -- Audio
    'audio/webm',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/wav',
    'audio/aac',
    'audio/flac',
    'audio/opus',
    -- Documents
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies
CREATE POLICY "DM owners can upload media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dm-media'
    AND auth.uid() = owner
  );

CREATE POLICY "DM owners can manage their media"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'dm-media' AND auth.uid() = owner)
  WITH CHECK (bucket_id = 'dm-media' AND auth.uid() = owner);

-- =============================================
-- REALTIME SETUP
-- =============================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_threads;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_participants;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_message_media;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.dm_threads REPLICA IDENTITY FULL;
ALTER TABLE public.dm_participants REPLICA IDENTITY FULL;
ALTER TABLE public.dm_messages REPLICA IDENTITY FULL;
ALTER TABLE public.dm_message_media REPLICA IDENTITY FULL;


