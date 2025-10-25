-- Create user_role enum type
CREATE TYPE user_role AS ENUM ('admin', 'community_owner', 'user');

-- Add role column to users table with default 'user'
ALTER TABLE public.users
ADD COLUMN role user_role NOT NULL DEFAULT 'user';

-- Create index on role for faster filtering
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Update the handle_new_user function to include role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    generate_username(
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    ),
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'user'::user_role  -- Default role for new users
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policy to allow admins to update any user's role
CREATE POLICY "Platform admins can update any user role"
  ON public.users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Update existing users to have 'user' role (if any exist)
UPDATE public.users SET role = 'user' WHERE role IS NULL;