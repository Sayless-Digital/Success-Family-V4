-- Create receipts bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies to avoid duplicates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload own receipts') THEN
    DROP POLICY "Users can upload own receipts" ON storage.objects;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can read own receipts') THEN
    DROP POLICY "Users can read own receipts" ON storage.objects;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins can manage all receipts') THEN
    DROP POLICY "Admins can manage all receipts" ON storage.objects;
  END IF;
END $$;

-- Allow owners to upload to their own folder: {user_id}/filename
CREATE POLICY "Users can upload own receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND (split_part(name, '/', 1) = auth.uid()::text)
);

-- Allow owners to read their own receipts
CREATE POLICY "Users can read own receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'receipts'
  AND (split_part(name, '/', 1) = auth.uid()::text)
);

-- Allow admins to manage all receipts
CREATE POLICY "Admins can manage all receipts"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'receipts' AND EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  )
) WITH CHECK (
  bucket_id = 'receipts' AND EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  )
);


