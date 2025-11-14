-- =============================================
-- CRM SYSTEM UPDATE MIGRATION
-- Updates: Global average minimum value, contacted date, dynamic contacts
-- =============================================

-- Add CRM average minimum value to platform_settings
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS crm_average_minimum_value_ttd NUMERIC(10, 2) DEFAULT 50.00 CHECK (crm_average_minimum_value_ttd >= 0);

-- Remove average_minimum_value_ttd from crm_stages (now global)
ALTER TABLE public.crm_stages
  DROP COLUMN IF EXISTS average_minimum_value_ttd;

-- Add contacted_date to crm_leads
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS contacted_date DATE;

-- Create contact type enum
CREATE TYPE crm_contact_type AS ENUM ('email', 'phone', 'tiktok', 'whatsapp', 'instagram', 'other');

-- Create CRM lead contacts table for dynamic contact information
CREATE TABLE IF NOT EXISTS public.crm_lead_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  contact_type crm_contact_type NOT NULL,
  value TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, contact_type, value)
);

-- Enable RLS
ALTER TABLE public.crm_lead_contacts ENABLE ROW LEVEL SECURITY;

-- Policies for CRM lead contacts (admin only)
CREATE POLICY "Only admins can view CRM lead contacts"
  ON public.crm_lead_contacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can manage CRM lead contacts"
  ON public.crm_lead_contacts
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_crm_lead_contacts_lead_id ON public.crm_lead_contacts(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_contacts_type ON public.crm_lead_contacts(contact_type);

-- Create trigger for updated_at
CREATE TRIGGER update_crm_lead_contacts_updated_at
  BEFORE UPDATE ON public.crm_lead_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing contact data to new contacts table (if any exists)
-- This will preserve existing email, phone, tiktok_handle data
DO $$
DECLARE
  lead_record RECORD;
BEGIN
  FOR lead_record IN SELECT id, email, phone, tiktok_handle FROM public.crm_leads
  LOOP
    -- Migrate email
    IF lead_record.email IS NOT NULL AND lead_record.email != '' THEN
      INSERT INTO public.crm_lead_contacts (lead_id, contact_type, value, is_primary)
      VALUES (lead_record.id, 'email', lead_record.email, true)
      ON CONFLICT (lead_id, contact_type, value) DO NOTHING;
    END IF;
    
    -- Migrate phone
    IF lead_record.phone IS NOT NULL AND lead_record.phone != '' THEN
      INSERT INTO public.crm_lead_contacts (lead_id, contact_type, value, is_primary)
      VALUES (lead_record.id, 'phone', lead_record.phone, false)
      ON CONFLICT (lead_id, contact_type, value) DO NOTHING;
    END IF;
    
    -- Migrate tiktok handle
    IF lead_record.tiktok_handle IS NOT NULL AND lead_record.tiktok_handle != '' THEN
      INSERT INTO public.crm_lead_contacts (lead_id, contact_type, value, is_primary)
      VALUES (lead_record.id, 'tiktok', lead_record.tiktok_handle, false)
      ON CONFLICT (lead_id, contact_type, value) DO NOTHING;
    END IF;
  END LOOP;
END $$;

