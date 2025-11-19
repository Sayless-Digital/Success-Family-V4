-- =============================================
-- USERNAME FORMAT VALIDATION MIGRATION
-- Enforces standard username format: lowercase letters, numbers, underscores
-- 3-30 characters, must start with a letter
-- =============================================

-- Create function to validate username format
CREATE OR REPLACE FUNCTION public.validate_username_format(username TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check length (3-30 characters)
  IF LENGTH(username) < 3 OR LENGTH(username) > 30 THEN
    RETURN FALSE;
  END IF;
  
  -- Check if it matches the pattern: starts with letter, followed by letters, numbers, or underscores
  -- No consecutive underscores, no leading/trailing underscores
  IF username !~ '^[a-z][a-z0-9_]*[a-z0-9]$|^[a-z]$' THEN
    RETURN FALSE;
  END IF;
  
  -- Check for consecutive underscores
  IF username ~ '__' THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add check constraint to users table
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS username_format_check;

ALTER TABLE public.users
ADD CONSTRAINT username_format_check
CHECK (validate_username_format(username));

-- Update generate_username function to ensure it generates valid usernames
CREATE OR REPLACE FUNCTION public.generate_username(first_name TEXT, last_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 0;
  cleaned_name TEXT;
BEGIN
  -- Create base username from first and last name
  -- Remove all non-alphanumeric characters, convert to lowercase
  cleaned_name := LOWER(REGEXP_REPLACE(first_name || last_name, '[^a-zA-Z0-9]', '', 'g'));
  
  -- Ensure it starts with a letter (if it doesn't, prepend 'user')
  IF cleaned_name !~ '^[a-z]' THEN
    cleaned_name := 'user' || cleaned_name;
  END IF;
  
  -- Limit to 27 characters to leave room for counter (max 3 digits)
  IF LENGTH(cleaned_name) > 27 THEN
    cleaned_name := SUBSTRING(cleaned_name FROM 1 FOR 27);
  END IF;
  
  -- Ensure minimum length of 3
  IF LENGTH(cleaned_name) < 3 THEN
    cleaned_name := cleaned_name || '123';
  END IF;
  
  base_username := cleaned_name;
  final_username := base_username;
  
  -- Check if username exists and append number if needed
  WHILE EXISTS (SELECT 1 FROM public.users WHERE username = final_username) LOOP
    counter := counter + 1;
    -- Ensure we don't exceed 30 characters total
    IF LENGTH(base_username) + LENGTH(counter::TEXT) > 30 THEN
      base_username := SUBSTRING(base_username FROM 1 FOR 30 - LENGTH(counter::TEXT));
    END IF;
    final_username := base_username || counter::TEXT;
  END LOOP;
  
  -- Final validation
  IF NOT validate_username_format(final_username) THEN
    -- Fallback to a safe default
    final_username := 'user' || counter::TEXT;
    WHILE EXISTS (SELECT 1 FROM public.users WHERE username = final_username) LOOP
      counter := counter + 1;
      final_username := 'user' || counter::TEXT;
    END LOOP;
  END IF;
  
  RETURN final_username;
END;
$$ LANGUAGE plpgsql;

-- Create function to normalize username (for updates)
CREATE OR REPLACE FUNCTION public.normalize_username(input_username TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Convert to lowercase
  input_username := LOWER(input_username);
  
  -- Remove all characters except letters, numbers, and underscores
  input_username := REGEXP_REPLACE(input_username, '[^a-z0-9_]', '', 'g');
  
  -- Remove consecutive underscores
  WHILE input_username ~ '__' LOOP
    input_username := REGEXP_REPLACE(input_username, '__', '_', 'g');
  END LOOP;
  
  -- Remove leading/trailing underscores
  input_username := TRIM(input_username, '_');
  
  -- Ensure it starts with a letter
  IF input_username !~ '^[a-z]' THEN
    input_username := 'user' || input_username;
  END IF;
  
  -- Ensure minimum length
  IF LENGTH(input_username) < 3 THEN
    input_username := input_username || '123';
  END IF;
  
  -- Limit to 30 characters
  IF LENGTH(input_username) > 30 THEN
    input_username := SUBSTRING(input_username FROM 1 FOR 30);
  END IF;
  
  -- Remove trailing underscore if any
  input_username := RTRIM(input_username, '_');
  
  RETURN input_username;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


