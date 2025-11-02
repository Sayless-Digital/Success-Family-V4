-- =============================================
-- ENABLE REALTIME SUBSCRIPTIONS
-- Enable real-time updates for tables that need live sync
-- =============================================

-- Enable realtime for post_boosts table (if not already enabled)
-- Allows live boost count updates across all users
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE post_boosts;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Table already in publication, ignore
END $$;

-- Set replica identity to FULL for post_boosts to enable DELETE events
-- This ensures all columns are included in the replication stream for DELETEs
ALTER TABLE post_boosts REPLICA IDENTITY FULL;

-- Enable realtime for posts table (if not already enabled)
-- Allows new post notifications in feeds
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE posts;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Table already in publication, ignore
END $$;

-- Enable realtime for wallets table (if not already enabled)
-- Allows wallet balance to update from any source (boosts, payouts, refunds)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE wallets;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Table already in publication, ignore
END $$;

-- Enable realtime for saved_posts table (if not already enabled)
-- Allows saved posts to update in real-time on profile pages
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE saved_posts;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Table already in publication, ignore
END $$;

-- Add comments to document why Realtime is enabled
COMMENT ON TABLE post_boosts IS 'Realtime enabled: Boost counts update live across all users viewing the same posts';
COMMENT ON TABLE posts IS 'Realtime enabled: New post notifications appear instantly in community feeds';
COMMENT ON TABLE wallets IS 'Realtime enabled: Wallet balance syncs across all tabs and update sources';
COMMENT ON TABLE saved_posts IS 'Realtime enabled: Saved posts update in real-time on profile pages';