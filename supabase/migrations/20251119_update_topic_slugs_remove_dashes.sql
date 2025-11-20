-- =============================================
-- NORMALIZE TOPIC SLUGS TO REMOVE DASHES/SPACES
-- =============================================

UPDATE public.topics
SET slug = lower(regexp_replace(slug, '[^a-z0-9]', '', 'g'))
WHERE slug ~ '[^a-z0-9]';


