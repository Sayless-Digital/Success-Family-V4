-- =============================================
-- CRM SYSTEM MIGRATION
-- Includes: Stages, Leads, Conversations, Sessions, and Notes
-- =============================================

-- Create enum types
CREATE TYPE crm_lead_source AS ENUM ('tiktok', 'whatsapp', 'instagram', 'email', 'referral', 'website', 'other');
CREATE TYPE crm_conversation_channel AS ENUM ('tiktok', 'whatsapp', 'instagram', 'email', 'phone', 'other');

-- =============================================
-- CRM STAGES TABLE
-- Sales pipeline stages with average minimum value per customer
-- =============================================
CREATE TABLE IF NOT EXISTS public.crm_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  average_minimum_value_ttd NUMERIC(10, 2) DEFAULT 0 CHECK (average_minimum_value_ttd >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name)
);

-- Enable RLS
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;

-- Policies for CRM stages (admin only)
CREATE POLICY "Only admins can view CRM stages"
  ON public.crm_stages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can manage CRM stages"
  ON public.crm_stages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- CRM LEADS TABLE
-- Lead contact information and tracking
-- =============================================
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  tiktok_handle TEXT,
  source crm_lead_source NOT NULL,
  stage_id UUID NOT NULL REFERENCES public.crm_stages(id) ON DELETE RESTRICT,
  potential_revenue_ttd NUMERIC(10, 2) CHECK (potential_revenue_ttd >= 0),
  close_date DATE,
  close_revenue_ttd NUMERIC(10, 2) CHECK (close_revenue_ttd >= 0),
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

-- Policies for CRM leads (admin only)
CREATE POLICY "Only admins can view CRM leads"
  ON public.crm_leads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can manage CRM leads"
  ON public.crm_leads
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- CRM CONVERSATIONS TABLE
-- One conversation per lead (can have multiple sessions)
-- =============================================
CREATE TABLE IF NOT EXISTS public.crm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.crm_conversations ENABLE ROW LEVEL SECURITY;

-- Policies for CRM conversations (admin only)
CREATE POLICY "Only admins can view CRM conversations"
  ON public.crm_conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can manage CRM conversations"
  ON public.crm_conversations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- CRM CONVERSATION SESSIONS TABLE
-- Multiple sessions per conversation (each session has a channel)
-- =============================================
CREATE TABLE IF NOT EXISTS public.crm_conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.crm_conversations(id) ON DELETE CASCADE,
  channel crm_conversation_channel NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.crm_conversation_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for CRM conversation sessions (admin only)
CREATE POLICY "Only admins can view CRM conversation sessions"
  ON public.crm_conversation_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can manage CRM conversation sessions"
  ON public.crm_conversation_sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- CRM NOTES TABLE
-- Notes attached to leads
-- =============================================
CREATE TABLE IF NOT EXISTS public.crm_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;

-- Policies for CRM notes (admin only)
CREATE POLICY "Only admins can view CRM notes"
  ON public.crm_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can manage CRM notes"
  ON public.crm_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_crm_stages_sort_order ON public.crm_stages(sort_order);
CREATE INDEX IF NOT EXISTS idx_crm_leads_stage_id ON public.crm_leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_created_at ON public.crm_leads(created_at);
CREATE INDEX IF NOT EXISTS idx_crm_conversations_lead_id ON public.crm_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_conversation_sessions_conversation_id ON public.crm_conversation_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_crm_notes_lead_id ON public.crm_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_notes_created_at ON public.crm_notes(created_at);

-- =============================================
-- TRIGGERS
-- =============================================
-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_crm_stages_updated_at
  BEFORE UPDATE ON public.crm_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_leads_updated_at
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_conversations_updated_at
  BEFORE UPDATE ON public.crm_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_conversation_sessions_updated_at
  BEFORE UPDATE ON public.crm_conversation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_notes_updated_at
  BEFORE UPDATE ON public.crm_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- INITIAL DEFAULT STAGES
-- =============================================
INSERT INTO public.crm_stages (name, description, average_minimum_value_ttd, sort_order) VALUES
  ('New Lead', 'Newly acquired leads', 50.00, 1),
  ('Contacted', 'Initial contact made', 50.00, 2),
  ('Qualified', 'Lead qualified and interested', 50.00, 3),
  ('Proposal', 'Proposal sent', 50.00, 4),
  ('Negotiation', 'Negotiating terms', 50.00, 5),
  ('Closed Won', 'Deal closed successfully', 50.00, 6),
  ('Closed Lost', 'Deal lost', 0.00, 7)
ON CONFLICT (name) DO NOTHING;

