-- =============================================
-- ADD SORT_ORDER TO CRM_LEADS
-- Enables ordering of leads within each stage for kanban board
-- =============================================

-- Add sort_order column to crm_leads
ALTER TABLE public.crm_leads
ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Create index on (stage_id, sort_order) for efficient queries
CREATE INDEX IF NOT EXISTS idx_crm_leads_stage_id_sort_order 
ON public.crm_leads(stage_id, sort_order);

-- Initialize sort_order for existing leads within each stage
-- Assign sequential order based on created_at within each stage
WITH ranked_leads AS (
  SELECT 
    id,
    stage_id,
    ROW_NUMBER() OVER (PARTITION BY stage_id ORDER BY created_at ASC) as rn
  FROM public.crm_leads
  WHERE sort_order = 0
)
UPDATE public.crm_leads
SET sort_order = ranked_leads.rn
FROM ranked_leads
WHERE crm_leads.id = ranked_leads.id;

-- Add comment for documentation
COMMENT ON COLUMN public.crm_leads.sort_order IS 'Ordering of leads within a stage (0-based, lower numbers appear first)';


