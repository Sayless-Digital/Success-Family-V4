-- =============================================
-- FIX COMMUNITY MEMBERS RLS RECURSION
-- Fixes infinite recursion error in RLS policies
-- =============================================

-- Problem: The "Community owners can manage members" policy was checking
-- the community_members table to verify ownership, which caused infinite
-- recursion because checking the policy itself triggered another policy check.

-- Solution: Check the communities table instead, which has owner_id field
-- and doesn't trigger the same recursion.

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Community owners can manage members" ON public.community_members;

-- Recreate the policy to check communities table instead
CREATE POLICY "Community owners can manage members"
  ON public.community_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_members.community_id
        AND c.owner_id = auth.uid()
    )
  );

-- Also add an INSERT policy for community owners
CREATE POLICY "Community owners can add members"
  ON public.community_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_members.community_id
        AND c.owner_id = auth.uid()
    )
  );

-- Add a policy to allow users to see their own memberships
CREATE POLICY "Users can view their own memberships"
  ON public.community_members
  FOR SELECT
  USING (user_id = auth.uid());

-- Summary of policies after this migration:
-- 1. "Anyone can view community members" - Public visibility
-- 2. "Users can view their own memberships" - Users can see their own records
-- 3. "Community owners can manage members" - Owners can UPDATE/DELETE (checks communities table)
-- 4. "Community owners can add members" - Owners can INSERT (checks communities table)

