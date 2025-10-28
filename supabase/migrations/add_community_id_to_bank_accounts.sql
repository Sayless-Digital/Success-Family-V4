-- =============================================
-- ADD COMMUNITY_ID TO BANK_ACCOUNTS MIGRATION
-- Adds community_id column for community-specific bank accounts
-- Allows both platform-wide accounts (community_id = NULL) and community-specific accounts
-- =============================================

-- Add community_id column to bank_accounts table for community-specific bank accounts
ALTER TABLE public.bank_accounts 
ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE;

-- Update existing bank accounts to have community_id NULL (platform-wide accounts)
UPDATE public.bank_accounts SET community_id = NULL WHERE community_id IS NULL;

-- Drop old policies
DROP POLICY IF EXISTS "Anyone can view active bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Only admins can manage bank accounts" ON public.bank_accounts;

-- Policy: Anyone can view active bank accounts (with or without community_id)
CREATE POLICY "Anyone can view active bank accounts"
  ON public.bank_accounts
  FOR SELECT
  USING (is_active = true);

-- Policy: Admins can manage all bank accounts
CREATE POLICY "Only admins can manage all bank accounts"
  ON public.bank_accounts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Community owners can manage their own community's bank accounts
CREATE POLICY "Community owners can manage their bank accounts"
  ON public.bank_accounts
  FOR ALL
  USING (
    community_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = bank_accounts.community_id
        AND c.owner_id = auth.uid()
    )
  );

-- Add index for community_id lookups
CREATE INDEX IF NOT EXISTS idx_bank_accounts_community_id ON public.bank_accounts(community_id);

