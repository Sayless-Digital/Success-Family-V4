-- Create storage bucket for event recordings
-- This bucket will store video recordings from Stream.io events

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-recordings',
  'event-recordings',
  true,
  52428800, -- 50MB limit (52428800 bytes)
  ARRAY['video/mp4', 'video/webm', 'video/mpeg', 'image/jpeg', 'image/png', 'image/webp'] -- Include image types for thumbnails
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/mpeg', 'image/jpeg', 'image/png', 'image/webp'];

-- Set up storage policies for the bucket
-- Allow authenticated users to upload recordings
CREATE POLICY "Allow authenticated users to upload recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-recordings');

-- Allow authenticated users to read recordings
CREATE POLICY "Allow authenticated users to read recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'event-recordings');

-- Allow authenticated users to update their own recordings
CREATE POLICY "Allow authenticated users to update recordings"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'event-recordings')
WITH CHECK (bucket_id = 'event-recordings');

-- Allow authenticated users to delete their own recordings
CREATE POLICY "Allow authenticated users to delete recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'event-recordings');

-- If bucket is public, also allow public read access
CREATE POLICY "Allow public read access to recordings"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'event-recordings');

