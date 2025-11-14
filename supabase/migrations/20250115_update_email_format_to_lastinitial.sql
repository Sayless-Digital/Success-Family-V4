-- Migration: Update email format from firstname.lastname to firstname.lastinitial
-- This changes the email generation to use only the first letter of the last name

-- Step 1: Update the generate_personalized_email function to use last initial
CREATE OR REPLACE FUNCTION public.generate_personalized_email(first_name TEXT, last_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_email TEXT;
  final_email TEXT;
  counter INTEGER := 0;
  domain TEXT := 'successfamily.online';
  last_initial TEXT;
BEGIN
  -- Extract first letter of last name (or empty string if last_name is empty)
  last_initial := CASE 
    WHEN LENGTH(TRIM(last_name)) > 0 THEN LOWER(SUBSTRING(TRIM(last_name) FROM 1 FOR 1))
    ELSE ''
  END;
  
  -- Create base email from first name and last initial (lowercase, replace spaces with dots)
  base_email := LOWER(REGEXP_REPLACE(
    TRIM(first_name) || CASE WHEN last_initial != '' THEN '.' || last_initial ELSE '' END,
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

-- Step 2: Update existing email addresses for all users
-- This function will regenerate email addresses for existing users
DO $$
DECLARE
  user_record RECORD;
  new_email TEXT;
  counter INTEGER;
  base_email TEXT;
  last_initial TEXT;
  domain TEXT := 'successfamily.online';
BEGIN
  -- Loop through all users who have email addresses
  FOR user_record IN 
    SELECT DISTINCT 
      u.id,
      u.first_name,
      u.last_name,
      ue.email_address as old_email
    FROM public.users u
    INNER JOIN public.user_emails ue ON ue.user_id = u.id
    WHERE ue.is_active = true
  LOOP
    -- Extract first letter of last name
    last_initial := CASE 
      WHEN LENGTH(TRIM(user_record.last_name)) > 0 THEN LOWER(SUBSTRING(TRIM(user_record.last_name) FROM 1 FOR 1))
      ELSE ''
    END;
    
    -- Generate base email
    base_email := LOWER(REGEXP_REPLACE(
      TRIM(user_record.first_name) || CASE WHEN last_initial != '' THEN '.' || last_initial ELSE '' END,
      '[^a-zA-Z0-9.]',
      '',
      'g'
    ));
    
    -- Remove consecutive dots
    base_email := REGEXP_REPLACE(base_email, '\.+', '.', 'g');
    
    -- Remove leading/trailing dots
    base_email := TRIM(base_email, '.');
    
    -- Generate new email address
    new_email := base_email || '@' || domain;
    counter := 0;
    
    -- Check if email exists (excluding the current user's old email)
    WHILE EXISTS (
      SELECT 1 FROM public.user_emails 
      WHERE email_address = new_email 
      AND user_id != user_record.id
    ) LOOP
      counter := counter + 1;
      new_email := base_email || counter::TEXT || '@' || domain;
    END LOOP;
    
    -- Update the email address in user_emails table
    -- Note: We're updating the email_address but keeping the same record
    -- This means Inbound addresses will need to be re-synced
    UPDATE public.user_emails
    SET 
      email_address = new_email,
      updated_at = NOW()
    WHERE user_id = user_record.id
    AND email_address = user_record.old_email;
    
    RAISE NOTICE 'Updated email for user %: % -> %', user_record.id, user_record.old_email, new_email;
  END LOOP;
END $$;

-- Update the function comment
COMMENT ON FUNCTION public.generate_personalized_email IS 'Generates a personalized email address from first name and last initial (first letter of last name), appending numbers if duplicate';



