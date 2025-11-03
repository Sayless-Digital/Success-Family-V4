-- Add 'audio' to the media_type enum
-- Note: ALTER TYPE ... ADD VALUE cannot use IF NOT EXISTS, so we use a DO block to check first
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'audio' 
        AND enumtypid = (
            SELECT oid 
            FROM pg_type 
            WHERE typname = 'media_type'
        )
    ) THEN
        ALTER TYPE media_type ADD VALUE 'audio';
    END IF;
END $$;

