-- =============================================
-- ALLOW USERS TO JOIN COMMUNITIES MIGRATION
-- Allows users to add themselves as members to communities
-- Needed for subscription/join flow
-- =============================================

-- Allow users to join communities themselves
-- This is needed for the subscription flow where users can join communities

-- Policy: Users can add themselves as members to any community
CREATE POLICY "Users can join communities as members"
  ON public.community_members
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    role = 'member'
  );

