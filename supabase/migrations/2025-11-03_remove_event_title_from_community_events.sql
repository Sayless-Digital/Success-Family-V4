-- Remove title from community_events; use description as the sole content field
DO $$
BEGIN
  ALTER TABLE community_events DROP COLUMN IF EXISTS title;
EXCEPTION
  WHEN undefined_column THEN
    NULL;
END $$;

COMMENT ON TABLE community_events IS 'Live stream events: title removed; use description/content only.';


