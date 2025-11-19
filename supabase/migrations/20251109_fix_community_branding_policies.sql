-- =============================================
-- FIX COMMUNITY BRANDING STORAGE POLICIES
-- Ensures foldername checks reference the storage object key
-- =============================================

-- Drop existing community logo policies
DROP POLICY IF EXISTS "Community owners can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Community owners can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Community owners can delete logos" ON storage.objects;

-- Drop existing community banner policies
DROP POLICY IF EXISTS "Community owners can upload banners" ON storage.objects;
DROP POLICY IF EXISTS "Community owners can update banners" ON storage.objects;
DROP POLICY IF EXISTS "Community owners can delete banners" ON storage.objects;

-- Recreate community logo policies with corrected folder checks
CREATE POLICY "Community owners can upload logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'community-logos'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM public.communities c
    WHERE c.owner_id = auth.uid()
  )
);

CREATE POLICY "Community owners can update logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'community-logos'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM public.communities c
    WHERE c.owner_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'community-logos'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM public.communities c
    WHERE c.owner_id = auth.uid()
  )
);

CREATE POLICY "Community owners can delete logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'community-logos'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM public.communities c
    WHERE c.owner_id = auth.uid()
  )
);

-- Recreate community banner policies with corrected folder checks
CREATE POLICY "Community owners can upload banners"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'community-banners'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM public.communities c
    WHERE c.owner_id = auth.uid()
  )
);

CREATE POLICY "Community owners can update banners"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'community-banners'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM public.communities c
    WHERE c.owner_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'community-banners'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM public.communities c
    WHERE c.owner_id = auth.uid()
  )
);

CREATE POLICY "Community owners can delete banners"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'community-banners'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM public.communities c
    WHERE c.owner_id = auth.uid()
  )
);


















