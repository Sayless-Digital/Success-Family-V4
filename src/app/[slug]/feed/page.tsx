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

  // Fetch posts with author and media - all posts are public now
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

  if (postsError) {
    console.error('Error fetching posts:', postsError)
  }

  // Enrich posts with boost counts and user's boost status
  const enrichedPosts = await Promise.all(
    (posts || []).map(async (post) => {
      // Get boost count
      const { data: boostCountData } = await supabase
        .rpc('get_post_boost_count', { p_post_id: post.id })

      // Get user's boost status if authenticated
      let userHasBoosted = false
      let canUnboost = false
      if (user) {
        const { data: userBoostedData } = await supabase
          .rpc('user_boosted_post', {
            p_post_id: post.id,
            p_user_id: user.id
          })
        userHasBoosted = userBoostedData || false

        // Check if user can unboost (within 1 minute)
        if (userHasBoosted) {
          const { data: canUnboostData } = await supabase
            .rpc('can_unboost_post', {
              p_post_id: post.id,
              p_user_id: user.id
            })
          canUnboost = canUnboostData || false
        }
      }

      return {
        ...post,
        boost_count: boostCountData || 0,
        user_has_boosted: userHasBoosted,
        can_unboost: canUnboost
      }
    })
  )

  return (
    <FeedView
      community={community}
      posts={enrichedPosts}
      isMember={isMember}
      currentUserId={user?.id}
    />
  )
}