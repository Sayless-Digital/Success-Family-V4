-- =============================================
-- POSTS SYSTEM MIGRATION
-- Includes: Posts, Categories, Media, and Storage
-- =============================================

-- Create enum types
CREATE TYPE post_visibility AS ENUM ('public', 'members_only', 'draft');
CREATE TYPE media_type AS ENUM ('image', 'video', 'document');

-- =============================================
-- POST CATEGORIES TABLE
-- Categories that can be assigned to posts
-- =============================================
CREATE TABLE IF NOT EXISTS public.post_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1', -- Default primary color
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, slug)
);

-- Enable RLS
ALTER TABLE public.post_categories ENABLE ROW LEVEL SECURITY;

-- Policies for post categories
CREATE POLICY "Anyone can view categories in active communities"
  ON public.post_categories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = post_categories.community_id
        AND c.is_active = true
    )
  );

CREATE POLICY "Community owners can manage categories"
  ON public.post_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = post_categories.community_id
        AND c.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = post_categories.community_id
        AND c.owner_id = auth.uid()
    )
  );

-- =============================================
-- POSTS TABLE
-- User-created posts within communities
-- =============================================
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  visibility post_visibility NOT NULL DEFAULT 'public',
  is_pinned BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Policies for posts
CREATE POLICY "Anyone can view public posts in active communities"
  ON public.posts
  FOR SELECT
  USING (
    visibility = 'public' AND
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = posts.community_id
        AND c.is_active = true
    )
  );

CREATE POLICY "Community members can view members-only posts"
  ON public.posts
  FOR SELECT
  USING (
    visibility = 'members_only' AND
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = posts.community_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Authors can view their own draft posts"
  ON public.posts
  FOR SELECT
  USING (
    visibility = 'draft' AND
    author_id = auth.uid()
  );

CREATE POLICY "Community members can create posts"
  ON public.posts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = posts.community_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Authors and community owners can update posts"
  ON public.posts
  FOR UPDATE
  USING (
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = posts.community_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Authors and community owners can delete posts"
  ON public.posts
  FOR DELETE
  USING (
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = posts.community_id
        AND c.owner_id = auth.uid()
    )
  );

-- =============================================
-- POST CATEGORY ASSIGNMENTS TABLE
-- Junction table for many-to-many relationship
-- =============================================
CREATE TABLE IF NOT EXISTS public.post_category_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.post_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, category_id)
);

-- Enable RLS
ALTER TABLE public.post_category_assignments ENABLE ROW LEVEL SECURITY;

-- Policies for post category assignments
CREATE POLICY "Anyone can view category assignments for visible posts"
  ON public.post_category_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_category_assignments.post_id
        AND (
          p.visibility = 'public' OR
          (p.visibility = 'members_only' AND EXISTS (
            SELECT 1 FROM public.community_members cm
            WHERE cm.community_id = p.community_id
              AND cm.user_id = auth.uid()
          )) OR
          (p.visibility = 'draft' AND p.author_id = auth.uid())
        )
    )
  );

CREATE POLICY "Post authors can manage their post categories"
  ON public.post_category_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_category_assignments.post_id
        AND p.author_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_category_assignments.post_id
        AND p.author_id = auth.uid()
    )
  );

-- =============================================
-- POST MEDIA TABLE
-- Media attachments for posts
-- =============================================
CREATE TABLE IF NOT EXISTS public.post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  media_type media_type NOT NULL,
  storage_path TEXT NOT NULL, -- Path in Supabase storage
  file_name TEXT NOT NULL,
  file_size INTEGER, -- Size in bytes
  mime_type TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;

-- Policies for post media
CREATE POLICY "Anyone can view media for visible posts"
  ON public.post_media
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_media.post_id
        AND (
          p.visibility = 'public' OR
          (p.visibility = 'members_only' AND EXISTS (
            SELECT 1 FROM public.community_members cm
            WHERE cm.community_id = p.community_id
              AND cm.user_id = auth.uid()
          )) OR
          (p.visibility = 'draft' AND p.author_id = auth.uid())
        )
    )
  );

CREATE POLICY "Post authors can manage their post media"
  ON public.post_media
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_media.post_id
        AND p.author_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_media.post_id
        AND p.author_id = auth.uid()
    )
  );

-- =============================================
-- STORAGE BUCKET SETUP
-- Create bucket for post media
-- =============================================

-- Insert storage bucket (this will be created via Supabase dashboard or CLI)
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for post-media bucket
CREATE POLICY "Anyone can view post media files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-media');

CREATE POLICY "Authenticated users can upload post media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'post-media' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update their own post media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'post-media' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own post media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'post-media' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to generate unique category slug
CREATE OR REPLACE FUNCTION public.generate_category_slug(category_name TEXT, community_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Create base slug (lowercase, replace spaces/special chars with hyphens)
  base_slug := LOWER(REGEXP_REPLACE(category_name, '[^a-zA-Z0-9]+', '-', 'g'));
  -- Remove leading/trailing hyphens
  base_slug := TRIM(BOTH '-' FROM base_slug);
  final_slug := base_slug;
  
  -- Check if slug exists in this community and append number if needed
  WHILE EXISTS (
    SELECT 1 FROM public.post_categories 
    WHERE slug = final_slug AND post_categories.community_id = generate_category_slug.community_id
  ) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter::TEXT;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to set published_at timestamp when post becomes public
CREATE OR REPLACE FUNCTION public.set_post_published_at()
RETURNS TRIGGER AS $$
BEGIN
  -- If visibility changed from draft to public/members_only and published_at is null
  IF NEW.visibility != 'draft' AND OLD.visibility = 'draft' AND NEW.published_at IS NULL THEN
    NEW.published_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger for updated_at columns
DROP TRIGGER IF EXISTS update_posts_updated_at ON public.posts;
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_post_categories_updated_at ON public.post_categories;
CREATE TRIGGER update_post_categories_updated_at
  BEFORE UPDATE ON public.post_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to set published_at
DROP TRIGGER IF EXISTS set_post_published_at_trigger ON public.posts;
CREATE TRIGGER set_post_published_at_trigger
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_post_published_at();

-- =============================================
-- INDEXES
-- =============================================

-- Post indexes
CREATE INDEX IF NOT EXISTS idx_posts_community_id ON public.posts(community_id);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON public.posts(visibility);
CREATE INDEX IF NOT EXISTS idx_posts_is_pinned ON public.posts(is_pinned);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON public.posts(published_at DESC);

-- Post categories indexes
CREATE INDEX IF NOT EXISTS idx_post_categories_community_id ON public.post_categories(community_id);
CREATE INDEX IF NOT EXISTS idx_post_categories_slug ON public.post_categories(slug);

-- Post category assignments indexes
CREATE INDEX IF NOT EXISTS idx_post_category_assignments_post_id ON public.post_category_assignments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_category_assignments_category_id ON public.post_category_assignments(category_id);

-- Post media indexes
CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON public.post_media(post_id);
CREATE INDEX IF NOT EXISTS idx_post_media_display_order ON public.post_media(display_order);

-- =============================================
-- SEED DEFAULT CATEGORIES (Optional)
-- Create some default categories for communities
-- =============================================

-- Note: This function can be called when a new community is created
CREATE OR REPLACE FUNCTION public.create_default_post_categories(p_community_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO public.post_categories (community_id, name, slug, description, color, created_by)
  VALUES
    (p_community_id, 'General', 'general', 'General discussions and updates', '#6366f1', p_user_id),
    (p_community_id, 'Announcements', 'announcements', 'Important announcements', '#f59e0b', p_user_id),
    (p_community_id, 'Events', 'events', 'Community events and meetups', '#10b981', p_user_id),
    (p_community_id, 'Q&A', 'qa', 'Questions and answers', '#8b5cf6', p_user_id)
  ON CONFLICT (community_id, slug) DO NOTHING;
END;
$$ LANGUAGE plpgsql;