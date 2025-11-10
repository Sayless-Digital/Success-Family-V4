import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getCommunityBySlug } from "@/lib/community-cache"
import FeedView from "./feed-view"
import { formatRelativeTime } from "@/lib/utils"
import { TopUpGuard } from "@/components/topup-guard"

interface FeedPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function FeedPage({ params }: FeedPageProps) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()
  
  // Fetch community data (always fresh)
  const community = await getCommunityBySlug(slug)
  if (!community) {
    notFound()
  }

  // Parallel data fetching for faster load
  const [userResult, postsResult] = await Promise.all([
    // Get user and membership status
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { user: null, isMember: false }
      
      const { data: membership } = await supabase
        .from('community_members')
        .select('id')
        .eq('community_id', community.id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      return { user, isMember: !!membership }
    })(),
    // Fetch posts
    supabase
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
      .eq('depth', 0)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(20)
  ])

  const { user, isMember } = userResult
  const { data: posts, error: postsError } = postsResult

  if (postsError) {
    console.error('Error fetching posts:', postsError)
  }

  // Enrich posts with boost counts and user's boost status using parallel batch queries
  const postIds = (posts || []).map(p => p.id)
  let enrichedPosts = posts || []

  if (postIds.length > 0) {
    // Parallel fetch boost counts and user boost status
    const [boostCountsResult, boostStatusResult] = await Promise.all([
      supabase.rpc('get_posts_boost_counts', { p_post_ids: postIds }),
      user 
        ? supabase.rpc('get_user_boosted_posts', { 
            p_post_ids: postIds,
            p_user_id: user.id 
          })
        : Promise.resolve({ data: [] })
    ])

    const { data: boostCountsData } = boostCountsResult
    const { data: boostStatusData } = boostStatusResult
    const userBoostStatus = boostStatusData || []

    // Create lookup maps for efficient enrichment
    type BoostStatus = {
      user_has_boosted: boolean
      can_unboost: boolean
    }

    const boostCountMap = new Map<string, number>(
      (boostCountsData || []).map((b: { post_id: string; boost_count: number }) => [b.post_id, b.boost_count])
    )
    const boostStatusMap = new Map<string, BoostStatus>(
      userBoostStatus.map((b: { post_id: string; user_has_boosted: boolean; can_unboost: boolean }) => [
        b.post_id,
        { user_has_boosted: b.user_has_boosted, can_unboost: b.can_unboost },
      ])
    )

    // Enrich posts with batch data
    enrichedPosts = (posts || []).map((post) => {
      const boostCount = boostCountMap.get(post.id) ?? 0
      const boostStatus = boostStatusMap.get(post.id) ?? { user_has_boosted: false, can_unboost: false }

      return {
        ...post,
        boost_count: boostCount,
        user_has_boosted: boostStatus.user_has_boosted,
        can_unboost: boostStatus.can_unboost
      }
    })
  }

  // Check if there are more posts (only if we got exactly 20)
  const hasMore = (posts || []).length === 20

  const serverNow = new Date()
  const initialRelativeTimes = Object.fromEntries(
    enrichedPosts.map((post) => [
      post.id,
      formatRelativeTime(post.published_at || post.created_at, { now: serverNow }),
    ]),
  ) as Record<string, string>

  return (
    <TopUpGuard communitySlug={slug}>
      <FeedView
        community={community}
        posts={enrichedPosts}
        isMember={isMember}
        currentUserId={user?.id}
        hasMore={hasMore}
        initialRelativeTimes={initialRelativeTimes}
      />
    </TopUpGuard>
  )
}