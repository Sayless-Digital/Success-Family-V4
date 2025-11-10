import { createServerSupabaseClient } from "@/lib/supabase-server"
import DiscoveryFeedView from "./discovery-feed-view"
import { formatRelativeTime } from "@/lib/utils"
import type { PostWithAuthor } from "@/types"

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Get platform settings for payout calculation and user goal
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('payout_minimum_ttd, user_value_per_point, user_goal')
    .single()
  
  const payoutMinimumTtd = Number(settings?.payout_minimum_ttd ?? 100)
  const userValuePerPoint = Number(settings?.user_value_per_point ?? 1)
  const minimumPayoutPoints = userValuePerPoint > 0 
    ? Math.ceil(payoutMinimumTtd / userValuePerPoint)
    : 0
  
  // Get total user count
  const { count: totalUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
  
  const userGoal = Number(settings?.user_goal ?? 100)
  const currentUserCount = totalUsers ?? 0
  
  // Fetch posts from all active communities
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
      community:communities!posts_community_id_fkey(
        id,
        name,
        slug,
        logo_url
      ),
      media:post_media(
        id,
        media_type,
        storage_path,
        file_name,
        display_order
      )
    `)
    .eq('depth', 0)
    .eq('is_pinned', false)
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(200) // Get more to rank
  
  if (postsError) {
    console.error('Error fetching posts:', postsError)
  }
  
  // If no posts, show empty state
  if (!posts || posts.length === 0) {
    return <DiscoveryFeedView posts={[]} currentUserId={user?.id} initialRelativeTimes={{}} payoutMinimumPoints={minimumPayoutPoints} currentUserCount={currentUserCount} userGoal={userGoal} />
  }
  
  const postIds = posts.map(p => p.id)
  const authorIds = [...new Set(posts.map(p => p.author_id))]
  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  
  // Parallel fetch: boost counts, recent boosts, author totals, author earnings
  const [
    boostCountsResult,
    recentBoostsResult,
    authorTotalsResult,
    authorEarningsResult
  ] = await Promise.all([
    supabase.rpc('get_posts_boost_counts', { p_post_ids: postIds }),
    // Get recent boosts (last 24 hours)
    supabase
      .from('post_boosts')
      .select('post_id, created_at')
      .in('post_id', postIds)
      .gte('created_at', twentyFourHoursAgo.toISOString()),
    // Get author total boost counts (for low-visibility detection)
    supabase.rpc('get_authors_total_boost_counts', { p_author_ids: authorIds }),
    // Get author earnings for payout milestone calculation
    supabase
      .from('wallets')
      .select('user_id, earnings_points')
      .in('user_id', authorIds)
  ])
  
  const boostCountMap = new Map<string, number>(
    (boostCountsResult.data || []).map((b: { post_id: string; boost_count: number }) => [b.post_id, b.boost_count])
  )
  
  const recentBoostsMap = new Map<string, number>()
  ;(recentBoostsResult.data || []).forEach((b: { post_id: string }) => {
    recentBoostsMap.set(b.post_id, (recentBoostsMap.get(b.post_id) || 0) + 1)
  })
  
  const authorTotalsMap = new Map<string, number>(
    (authorTotalsResult.data || []).map((a: { author_id: string; total_boost_count: number }) => [a.author_id, Number(a.total_boost_count)])
  )
  
  const authorEarningsMap = new Map<string, number>(
    (authorEarningsResult.data || []).map((w: { user_id: string; earnings_points: number }) => [w.user_id, Number(w.earnings_points || 0)])
  )
  
  // Enrich posts with ranking data
  type EnrichedPost = PostWithAuthor & {
    boost_count: number
    discovery_score: number
    recent_boosts: number
    author_total_boosts: number
    is_low_visibility: boolean
    is_near_payout: boolean
    points_to_payout: number
    popular_score: number
    created_timestamp: number
    user_has_boosted: boolean
    can_unboost: boolean
    community?: {
      id: string
      name: string
      slug: string
      logo_url?: string | null
    }
  }
  
  const enrichedPosts: EnrichedPost[] = posts.map(post => {
    const boostCount = boostCountMap.get(post.id) || 0
    const recentBoosts = recentBoostsMap.get(post.id) || 0
    const postDate = new Date(post.published_at || post.created_at)
    const postAgeHours = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60)
    
    // Calculate discovery score: (recent_boosts * 3) + total_boosts + recency_factor
    const recencyFactor = 100 / (postAgeHours + 1)
    const discoveryScore = (recentBoosts * 3) + boostCount + recencyFactor
    
    // Get author data
    const authorTotalBoosts = authorTotalsMap.get(post.author_id) || 0
    const authorEarnings = authorEarningsResult.data?.find((w: { user_id: string }) => w.user_id === post.author_id)?.earnings_points || 0
    const pointsToPayout = Math.max(0, minimumPayoutPoints - Number(authorEarnings))
    const isNearPayout = pointsToPayout > 0 && pointsToPayout <= 20
    
    // Extract community data (could be nested as 'community' or 'communities')
    const communityData = (post as any).community || (post as any).communities
    
    return {
      ...post,
      boost_count: boostCount,
      discovery_score: discoveryScore,
      recent_boosts: recentBoosts,
      author_total_boosts: authorTotalBoosts,
      is_low_visibility: authorTotalBoosts < 10,
      is_near_payout: isNearPayout,
      points_to_payout: pointsToPayout,
      popular_score: boostCount, // For Popular tab
      created_timestamp: postDate.getTime(), // For Recent tab
      user_has_boosted: false, // Will be set below
      can_unboost: false, // Will be set below
      community: communityData ? {
        id: communityData.id,
        name: communityData.name,
        slug: communityData.slug,
        logo_url: communityData.logo_url
      } : undefined
    } as EnrichedPost
  })
  
  // Get user boost status if authenticated
  let finalPosts: EnrichedPost[] = enrichedPosts
  if (user && postIds.length > 0) {
    const { data: userBoostStatus } = await supabase.rpc('get_user_boosted_posts', {
      p_post_ids: postIds,
      p_user_id: user.id
    })
    
    type BoostStatus = {
      user_has_boosted: boolean
      can_unboost: boolean
    }
    
    const boostStatusMap = new Map<string, BoostStatus>(
      (userBoostStatus || []).map((b: { post_id: string; user_has_boosted: boolean; can_unboost: boolean }) => [
        b.post_id,
        { user_has_boosted: b.user_has_boosted, can_unboost: b.can_unboost }
      ])
    )
    
    finalPosts = enrichedPosts.map(post => {
      const boostStatus = boostStatusMap.get(post.id)
      return {
        ...post,
        user_has_boosted: boostStatus?.user_has_boosted ?? false,
        can_unboost: boostStatus?.can_unboost ?? false
      }
    })
  }
  
  const initialRelativeTimes = Object.fromEntries(
    finalPosts.map(post => [
      post.id,
      formatRelativeTime(post.published_at || post.created_at, { now })
    ])
  )
  
  return (
    <DiscoveryFeedView
      posts={finalPosts}
      currentUserId={user?.id}
      initialRelativeTimes={initialRelativeTimes}
      payoutMinimumPoints={minimumPayoutPoints}
      currentUserCount={currentUserCount}
      userGoal={userGoal}
    />
  )
}