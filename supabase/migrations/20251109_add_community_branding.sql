-- =============================================
-- ADD COMMUNITY BRANDING FIELDS
-- Adds logo_url and banner_url columns to communities table
-- =============================================

-- Add logo_url and banner_url columns
ALTER TABLE public.communities
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Create storage buckets for community branding
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('community-logos', 'community-logos', true, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']::text[]),
  ('community-banners', 'community-banners', true, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']::text[])
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- STORAGE POLICIES FOR COMMUNITY-LOGOS BUCKET
-- =============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view community logos" ON storage.objects;
DROP POLICY IF EXISTS "Community owners can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Community owners can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Community owners can delete logos" ON storage.objects;

-- Allow anyone to view community logos
CREATE POLICY "Anyone can view community logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'community-logos');

-- Allow community owners to upload logos
CREATE POLICY "Community owners can upload logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'community-logos' AND
  EXISTS (
    SELECT 1 FROM public.communities
    WHERE id::text = (storage.foldername(name))[1]
    AND owner_id = auth.uid()
  )
);

-- Allow community owners to update their logos
CREATE POLICY "Community owners can update logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'community-logos' AND
  EXISTS (
    SELECT 1 FROM public.communities
    WHERE id::text = (storage.foldername(name))[1]
    AND owner_id = auth.uid()
  )
);

-- Allow community owners to delete their logos
CREATE POLICY "Community owners can delete logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'community-logos' AND
  EXISTS (
    SELECT 1 FROM public.communities
    WHERE id::text = (storage.foldername(name))[1]
    AND owner_id = auth.uid()
  )
);

-- =============================================
-- STORAGE POLICIES FOR COMMUNITY-BANNERS BUCKET
-- =============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view community banners" ON storage.objects;
DROP POLICY IF EXISTS "Community owners can upload banners" ON storage.objects;
DROP POLICY IF EXISTS "Community owners can update banners" ON storage.objects;
DROP POLICY IF EXISTS "Community owners can delete banners" ON storage.objects;

-- Allow anyone to view community banners
CREATE POLICY "Anyone can view community banners"
ON storage.objects
FOR SELECT
USING (bucket_id = 'community-banners');

-- Allow community owners to upload banners
CREATE POLICY "Community owners can upload banners"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'community-banners' AND
  EXISTS (
    SELECT 1 FROM public.communities
    WHERE id::text = (storage.foldername(name))[1]
    AND owner_id = auth.uid()
  )
);

-- Allow community owners to update their banners
CREATE POLICY "Community owners can update banners"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'community-banners' AND
  EXISTS (
    SELECT 1 FROM public.communities
    WHERE id::text = (storage.foldername(name))[1]
    AND owner_id = auth.uid()
  )
);

-- Allow community owners to delete their banners
CREATE POLICY "Community owners can delete banners"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'community-banners' AND
  EXISTS (
    SELECT 1 FROM public.communities
    WHERE id::text = (storage.foldername(name))[1]
    AND owner_id = auth.uid()
  )
);