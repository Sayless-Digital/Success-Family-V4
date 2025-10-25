-- =============================================
-- COMMUNITY SYSTEM MIGRATION
-- Includes: Bank Accounts, Plans, Communities, Members, and Payment Receipts
-- =============================================

-- Create enum types
CREATE TYPE account_type AS ENUM ('savings', 'checking');
CREATE TYPE community_member_role AS ENUM ('owner', 'member');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'annual');
CREATE TYPE payment_status AS ENUM ('pending', 'verified', 'rejected');

-- =============================================
-- BANK ACCOUNTS TABLE
-- Platform admin managed bank accounts for payment
-- =============================================
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type account_type NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Policies for bank accounts
CREATE POLICY "Anyone can view active bank accounts"
  ON public.bank_accounts
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Only admins can manage bank accounts"
  ON public.bank_accounts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- SUBSCRIPTION PLANS TABLE
-- Platform admin managed subscription plans
-- =============================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  max_tree INTEGER NOT NULL CHECK (max_tree > 0),
  monthly_price DECIMAL(10, 2) NOT NULL CHECK (monthly_price >= 0),
  annual_price DECIMAL(10, 2) NOT NULL CHECK (annual_price >= 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Policies for subscription plans
CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Only admins can manage plans"
  ON public.subscription_plans
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- COMMUNITIES TABLE
-- User-created communities with subscriptions
-- =============================================
CREATE TABLE IF NOT EXISTS public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  billing_cycle billing_cycle NOT NULL,
  subscription_start_date TIMESTAMPTZ,
  subscription_end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

-- Policies for communities
CREATE POLICY "Anyone can view active communities"
  ON public.communities
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users can create communities"
  ON public.communities
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their communities"
  ON public.communities
  FOR UPDATE
  USING (
    auth.uid() = owner_id OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- COMMUNITY MEMBERS TABLE
-- Track membership and roles within communities
-- =============================================
CREATE TABLE IF NOT EXISTS public.community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role community_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);

-- Enable RLS
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

-- Policies for community members
CREATE POLICY "Community members can view other members"
  ON public.community_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_members.community_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Community owners can manage members"
  ON public.community_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_members.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'owner'
    )
  );

-- =============================================
-- PAYMENT RECEIPTS TABLE
-- Track payment receipts for community subscriptions
-- =============================================
CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  billing_cycle billing_cycle NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  receipt_url TEXT NOT NULL,
  status payment_status DEFAULT 'pending',
  verified_by UUID REFERENCES public.users(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

-- Policies for payment receipts
CREATE POLICY "Users can view their own receipts"
  ON public.payment_receipts
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create receipts"
  ON public.payment_receipts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all receipts"
  ON public.payment_receipts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to generate unique slug from community name
CREATE OR REPLACE FUNCTION public.generate_community_slug(community_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Create base slug (lowercase, replace spaces/special chars with hyphens)
  base_slug := LOWER(REGEXP_REPLACE(community_name, '[^a-zA-Z0-9]+', '-', 'g'));
  -- Remove leading/trailing hyphens
  base_slug := TRIM(BOTH '-' FROM base_slug);
  final_slug := base_slug;
  
  -- Check if slug exists and append number if needed
  WHILE EXISTS (SELECT 1 FROM public.communities WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter::TEXT;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-add community creator as owner
CREATE OR REPLACE FUNCTION public.add_community_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Add the community creator as an owner
  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  
  -- Update user role to community_owner if not already admin
  UPDATE public.users
  SET role = 'community_owner'
  WHERE id = NEW.owner_id AND role = 'user';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger to auto-add owner when community is created
DROP TRIGGER IF EXISTS on_community_created ON public.communities;
CREATE TRIGGER on_community_created
  AFTER INSERT ON public.communities
  FOR EACH ROW
  EXECUTE FUNCTION public.add_community_owner();

-- Triggers for updated_at columns
DROP TRIGGER IF EXISTS update_bank_accounts_updated_at ON public.bank_accounts;
CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_communities_updated_at ON public.communities;
CREATE TRIGGER update_communities_updated_at
  BEFORE UPDATE ON public.communities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_receipts_updated_at ON public.payment_receipts;
CREATE TRIGGER update_payment_receipts_updated_at
  BEFORE UPDATE ON public.payment_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- INDEXES
-- =============================================

-- Community indexes
CREATE INDEX IF NOT EXISTS idx_communities_slug ON public.communities(slug);
CREATE INDEX IF NOT EXISTS idx_communities_owner_id ON public.communities(owner_id);
CREATE INDEX IF NOT EXISTS idx_communities_plan_id ON public.communities(plan_id);
CREATE INDEX IF NOT EXISTS idx_communities_is_active ON public.communities(is_active);

-- Community members indexes
CREATE INDEX IF NOT EXISTS idx_community_members_community_id ON public.community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user_id ON public.community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_role ON public.community_members(role);

-- Payment receipts indexes
CREATE INDEX IF NOT EXISTS idx_payment_receipts_community_id ON public.payment_receipts(community_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_user_id ON public.payment_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_status ON public.payment_receipts(status);

-- Bank accounts indexes
CREATE INDEX IF NOT EXISTS idx_bank_accounts_is_active ON public.bank_accounts(is_active);

-- Subscription plans indexes
CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active ON public.subscription_plans(is_active);