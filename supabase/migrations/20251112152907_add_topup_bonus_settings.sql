-- =============================================
-- ADD TOP-UP BONUS SETTINGS
-- Adds configuration for temporary top-up bonus feature
-- =============================================

-- Add top-up bonus settings to platform_settings table
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS topup_bonus_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS topup_bonus_points BIGINT NOT NULL DEFAULT 0;

-- Update existing row with defaults if columns were just added
UPDATE public.platform_settings
SET 
  topup_bonus_enabled = COALESCE(topup_bonus_enabled, false),
  topup_bonus_points = COALESCE(topup_bonus_points, 0)
WHERE id = 1;

COMMENT ON COLUMN public.platform_settings.topup_bonus_enabled IS 'Whether the top-up bonus feature is currently enabled';
COMMENT ON COLUMN public.platform_settings.topup_bonus_points IS 'Fixed number of bonus points awarded on first top-up when bonus is enabled';

