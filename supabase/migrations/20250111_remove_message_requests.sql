-- =============================================
-- REMOVE MESSAGE REQUEST SYSTEM
-- Allows users to message anyone directly without requests
-- =============================================

-- 1. Update all existing threads to have request_required = false
UPDATE public.dm_threads
SET 
  request_required = false,
  request_resolved_at = COALESCE(request_resolved_at, NOW())
WHERE request_required = true;

-- 2. Update all pending participants to active status
UPDATE public.dm_participants
SET status = 'active'
WHERE status = 'pending';

-- 3. Remove the trigger that sets request_required based on follow status
DROP TRIGGER IF EXISTS set_dm_request_flag_trigger ON public.dm_threads;

-- 4. Update the initialize_dm_participants function to always create active participants
CREATE OR REPLACE FUNCTION public.initialize_dm_participants()
RETURNS TRIGGER AS $$
DECLARE
  other_user UUID;
BEGIN
  IF NEW.initiated_by = NEW.user_a_id THEN
    other_user := NEW.user_b_id;
  ELSE
    other_user := NEW.user_a_id;
  END IF;

  -- Always create participants as active (no request system)
  INSERT INTO public.dm_participants (thread_id, user_id, status, last_seen_at, last_read_at)
  VALUES (NEW.id, NEW.initiated_by, 'active', NOW(), NOW())
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO public.dm_participants (thread_id, user_id, status, last_seen_at, last_read_at)
  VALUES (NEW.id, other_user, 'active', NOW(), NOW())
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  -- Always set request_required to false and resolve immediately
  IF NEW.request_required THEN
    UPDATE public.dm_threads
    SET 
      request_required = false,
      request_resolved_at = NOW()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. Create a new trigger function that always sets request_required = false
CREATE OR REPLACE FUNCTION public.set_dm_request_flag()
RETURNS TRIGGER AS $$
BEGIN
  -- Always allow direct messaging (no requests required)
  NEW.request_required := false;
  NEW.request_resolved_at := COALESCE(NEW.request_resolved_at, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 6. Recreate the trigger to always set request_required = false
CREATE TRIGGER set_dm_request_flag_trigger
  BEFORE INSERT ON public.dm_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_dm_request_flag();

-- 7. Update the RLS policy to allow message insertion for active and pending participants
-- (Keep pending for backwards compatibility, but they should all be active now)
-- Actually, the policy already allows 'pending' status, so we just need to ensure
-- the code doesn't check for active status only

COMMENT ON COLUMN public.dm_threads.request_required
  IS 'DEPRECATED: Always false. Message requests are no longer used.';

















