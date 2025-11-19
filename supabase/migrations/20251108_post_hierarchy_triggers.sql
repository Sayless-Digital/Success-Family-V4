-- =============================================
-- POST HIERARCHY TRIGGERS & MEDIA GUARDRAILS
-- Ensures depth, community alignment, and media restrictions
-- =============================================

-- Recreate depth constraint with explicit max depth (0 = post, 1 = comment, 2 = reply)
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_depth_hierarchy_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_depth_hierarchy_check
  CHECK (
    depth BETWEEN 0 AND 2 AND (
      (parent_post_id IS NULL AND depth = 0) OR
      (parent_post_id IS NOT NULL AND depth > 0)
    )
  );

-- Function to set depth/community/published_at automatically
CREATE OR REPLACE FUNCTION public.handle_post_hierarchy()
RETURNS trigger AS $$
DECLARE
  parent_record public.posts%ROWTYPE;
BEGIN
  IF NEW.parent_post_id IS NULL THEN
    NEW.depth := 0;
  ELSE
    SELECT * INTO parent_record FROM public.posts WHERE id = NEW.parent_post_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parent post % not found', NEW.parent_post_id;
    END IF;

    NEW.depth := parent_record.depth + 1;
    NEW.community_id := parent_record.community_id;

    IF NEW.depth > 2 THEN
      RAISE EXCEPTION 'Replies cannot be nested beyond one level';
    END IF;
  END IF;

  -- Ensure published_at defaults to now for new entries when not provided
  IF NEW.published_at IS NULL THEN
    NEW.published_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply hierarchy function on inserts
DROP TRIGGER IF EXISTS set_post_hierarchy ON public.posts;
CREATE TRIGGER set_post_hierarchy
  BEFORE INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_post_hierarchy();

-- Prevent manual changes to hierarchy on update
CREATE OR REPLACE FUNCTION public.prevent_hierarchy_updates()
RETURNS trigger AS $$
BEGIN
  IF NEW.parent_post_id IS DISTINCT FROM OLD.parent_post_id THEN
    RAISE EXCEPTION 'parent_post_id cannot be changed after creation';
  END IF;

  IF NEW.depth IS DISTINCT FROM OLD.depth THEN
    RAISE EXCEPTION 'depth cannot be changed after creation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_post_hierarchy_on_update ON public.posts;
CREATE TRIGGER enforce_post_hierarchy_on_update
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_hierarchy_updates();

-- Media restrictions based on depth
CREATE OR REPLACE FUNCTION public.enforce_post_media_restrictions()
RETURNS trigger AS $$
DECLARE
  target_post public.posts%ROWTYPE;
BEGIN
  IF NEW.post_id IS NULL THEN
    RAISE EXCEPTION 'Media must belong to a post';
  END IF;

  SELECT * INTO target_post FROM public.posts WHERE id = NEW.post_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated post % not found for media', NEW.post_id;
  END IF;

  IF target_post.depth >= 2 THEN
    RAISE EXCEPTION 'Replies cannot include media attachments';
  END IF;

  IF target_post.depth = 1 AND NEW.media_type <> 'audio' THEN
    RAISE EXCEPTION 'Comments support voice notes only';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_post_media_restrictions ON public.post_media;
CREATE TRIGGER enforce_post_media_restrictions
  BEFORE INSERT OR UPDATE ON public.post_media
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_post_media_restrictions();





















