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

  // Fetch initial 20 posts with author and media - all posts are public now
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
      ),
      media:post_media(
        id,
        media_type,
        storage_path,
        file_name,
        display_order
      )
    `)
    .eq('community_id', community.id)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(20)

  if (postsError) {
    console.error('Error fetching posts:', postsError)
  }

  // Enrich posts with boost counts and user's boost status using batch queries
  const postIds = (posts || []).map(p => p.id)
  let enrichedPosts = posts || []

  if (postIds.length > 0) {
    // Batch fetch boost counts for all posts
    const { data: boostCountsData } = await supabase
      .rpc('get_posts_boost_counts', { p_post_ids: postIds })

    // Batch fetch user boost status if authenticated
    let userBoostStatus: Array<{ post_id: string; user_has_boosted: boolean; can_unboost: boolean }> = []
    if (user) {
      const { data: boostStatusData } = await supabase
        .rpc('get_user_boosted_posts', { 
          p_post_ids: postIds,
          p_user_id: user.id 
        })
      userBoostStatus = boostStatusData || []
    }

    // Create lookup maps for efficient enrichment
    const boostCountMap = new Map(
      (boostCountsData || []).map((b: { post_id: string; boost_count: number }) => [b.post_id, b.boost_count])
    )
    const boostStatusMap = new Map(
      userBoostStatus.map((b: { post_id: string; user_has_boosted: boolean; can_unboost: boolean }) => [b.post_id, { user_has_boosted: b.user_has_boosted, can_unboost: b.can_unboost }])
    )

    // Enrich posts with batch data
    enrichedPosts = (posts || []).map((post) => {
      const boostCount = boostCountMap.get(post.id) || 0
      const boostStatus = boostStatusMap.get(post.id) || { user_has_boosted: false, can_unboost: false }

      return {
        ...post,
        boost_count: boostCount,
        user_has_boosted: boostStatus.user_has_boosted,
        can_unboost: boostStatus.can_unboost
      }
    })
  }

  // Check if there are more posts to load
  const { count: totalPostsCount } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('community_id', community.id)

  const hasMore = (totalPostsCount || 0) > 20

  return (
    <FeedView
      community={community}
      posts={enrichedPosts}
      isMember={isMember}
      currentUserId={user?.id}
      hasMore={hasMore}
    />
  )
}