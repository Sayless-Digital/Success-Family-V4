import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import FeedView from "./feed-view"

interface FeedPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function FeedPage({ params }: FeedPageProps) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()
  
  // Fetch community data
  const { data: community, error: communityError } = await supabase
    .from('communities')
    .select('id, name, slug, description, owner_id')
    .eq('slug', slug)
    .single()

  if (communityError || !community) {
    notFound()
  }

  // Check if user is authenticated and get their membership status
  const { data: { user } } = await supabase.auth.getUser()
  
  let isMember = false
  
  if (user) {
    const { data: membership } = await supabase
      .from('community_members')
      .select('id')
      .eq('community_id', community.id)
      .eq('user_id', user.id)
      .single()
    
    isMember = !!membership
  }

  // Fetch posts with author - all posts are public now
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select(`
      *,
      author:users!posts_author_id_fkey(
        id,
        username,
        first_name,
        last_name,
        profile_picture
      )
    `)
    .eq('community_id', community.id)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (postsError) {
    console.error('Error fetching posts:', postsError)
  }

  return (
    <FeedView
      community={community}
      posts={posts || []}
      isMember={isMember}
      currentUserId={user?.id}
    />
  )
}