-- Migration: Add personalized email functionality
-- This allows users to have personalized email addresses based on their name

-- Create user_emails table to store personalized email addresses
CREATE TABLE IF NOT EXISTS public.user_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email_address TEXT UNIQUE NOT NULL, -- e.g., "john.doe@successfamily.online"
  inbound_address_id TEXT, -- Inbound API address ID
  inbound_endpoint_id TEXT, -- Inbound API endpoint ID for webhooks
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email_address)
);

-- Create user_email_messages table to store sent and received emails
CREATE TABLE IF NOT EXISTS public.user_email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL, -- The user's email address used
  message_type TEXT NOT NULL CHECK (message_type IN ('sent', 'received')),
  inbound_email_id TEXT, -- Inbound API email ID
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  html_content TEXT,
  text_content TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_emails_user_id ON public.user_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_user_emails_email_address ON public.user_emails(email_address);
CREATE INDEX IF NOT EXISTS idx_user_emails_active ON public.user_emails(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_email_messages_user_id ON public.user_email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_email_messages_email_address ON public.user_email_messages(email_address);
CREATE INDEX IF NOT EXISTS idx_user_email_messages_message_type ON public.user_email_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_user_email_messages_created_at ON public.user_email_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_email_messages_is_read ON public.user_email_messages(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_user_email_messages_is_archived ON public.user_email_messages(is_archived) WHERE is_archived = false;

-- Enable Row Level Security
ALTER TABLE public.user_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_email_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_emails
-- Users can view their own email addresses
CREATE POLICY "Users can view their own email addresses"
  ON public.user_emails
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own email addresses
CREATE POLICY "Users can insert their own email addresses"
  ON public.user_emails
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own email addresses
CREATE POLICY "Users can update their own email addresses"
  ON public.user_emails
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_email_messages
-- Users can view their own email messages
CREATE POLICY "Users can view their own email messages"
  ON public.user_email_messages
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own email messages (for sent emails)
CREATE POLICY "Users can insert their own email messages"
  ON public.user_email_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own email messages (mark as read, archive, etc.)
CREATE POLICY "Users can update their own email messages"
  ON public.user_email_messages
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to generate personalized email address from first and last name
CREATE OR REPLACE FUNCTION public.generate_personalized_email(first_name TEXT, last_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_email TEXT;
  final_email TEXT;
  counter INTEGER := 0;
  domain TEXT := 'successfamily.online';
BEGIN
  -- Create base email from first and last name (lowercase, replace spaces with dots)
  base_email := LOWER(REGEXP_REPLACE(
    TRIM(first_name) || '.' || TRIM(last_name),
    '[^a-zA-Z0-9.]',
    '',
    'g'
  ));
  
  -- Remove consecutive dots
  base_email := REGEXP_REPLACE(base_email, '\.+', '.', 'g');
  
  -- Remove leading/trailing dots
  base_email := TRIM(base_email, '.');
  
  final_email := base_email || '@' || domain;
  
  -- Check if email exists and append number if needed
  WHILE EXISTS (SELECT 1 FROM public.user_emails WHERE email_address = final_email) LOOP
    counter := counter + 1;
    final_email := base_email || counter::TEXT || '@' || domain;
  END LOOP;
  
  RETURN final_email;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_user_email_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER set_user_emails_updated_at
  BEFORE UPDATE ON public.user_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_email_updated_at();

CREATE TRIGGER set_user_email_messages_updated_at
  BEFORE UPDATE ON public.user_email_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_email_updated_at();

-- Add comment for documentation
COMMENT ON TABLE public.user_emails IS 'Stores personalized email addresses for users';
COMMENT ON TABLE public.user_email_messages IS 'Stores sent and received emails for users';
COMMENT ON FUNCTION public.generate_personalized_email IS 'Generates a personalized email address from first and last name, appending numbers if duplicate';

