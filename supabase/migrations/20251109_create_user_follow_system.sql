-- =============================================
-- USER FOLLOW SYSTEM
-- Sets up follower relationships between users with RLS and realtime support
-- =============================================

-- Create table to track follow relationships
CREATE TABLE IF NOT EXISTS public.user_follows (
  follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_follows_pkey PRIMARY KEY (follower_id, followed_id),
  CONSTRAINT user_follows_no_self_follow CHECK (follower_id <> followed_id)
);

COMMENT ON TABLE public.user_follows
  IS 'Follower relationships between users. Mutual rows indicate mutual follows.';

CREATE INDEX IF NOT EXISTS idx_user_follows_followed_id ON public.user_follows(followed_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON public.user_follows(follower_id);

-- Enable RLS and define policies
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read follow relationships for social features
CREATE POLICY "Authenticated users can view follow relationships"
  ON public.user_follows
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow a user to follow another user
CREATE POLICY "Users can follow others"
  ON public.user_follows
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id AND follower_id <> followed_id);

-- Allow a follower to unfollow
CREATE POLICY "Followers can unfollow"
  ON public.user_follows
  FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- Allow the followed user to remove a follower (soft-block)
CREATE POLICY "Followed users can remove followers"
  ON public.user_follows
  FOR DELETE
  TO authenticated
  USING (auth.uid() = followed_id);

-- =============================================
-- SUPPORTING VIEWS
-- =============================================

-- View to expose follower/following counts per user
CREATE OR REPLACE VIEW public.user_follow_stats AS
SELECT
  u.id AS user_id,
  COALESCE(f.followers_count, 0) AS followers_count,
  COALESCE(g.following_count, 0) AS following_count
FROM public.users u
LEFT JOIN (
  SELECT followed_id, COUNT(*)::BIGINT AS followers_count
  FROM public.user_follows
  GROUP BY followed_id
) f ON f.followed_id = u.id
LEFT JOIN (
  SELECT follower_id, COUNT(*)::BIGINT AS following_count
  FROM public.user_follows
  GROUP BY follower_id
) g ON g.follower_id = u.id;

GRANT SELECT ON public.user_follow_stats TO authenticated;

COMMENT ON VIEW public.user_follow_stats
  IS 'Aggregated follower and following counts for each user.';

-- =============================================
-- REALTIME SETUP
-- =============================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_follows;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

ALTER TABLE public.user_follows REPLICA IDENTITY FULL;






