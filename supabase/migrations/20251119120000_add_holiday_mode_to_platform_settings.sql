-- Add holiday mode control to platform settings
ALTER TABLE public.platform_settings
ADD COLUMN IF NOT EXISTS holiday_mode text NOT NULL DEFAULT 'none';

COMMENT ON COLUMN public.platform_settings.holiday_mode IS 'Current holiday theme (none, christmas, etc)';

-- Ensure existing row has a sane value
UPDATE public.platform_settings
SET holiday_mode = 'none'
WHERE id = 1
  AND (holiday_mode IS NULL OR holiday_mode = '');

