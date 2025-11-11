import { createServerSupabaseClient, createPublicSupabaseClient } from "@/lib/supabase-server"
import DiscoveryFeedView from "./discovery-feed-view"
import { formatRelativeTime } from "@/lib/utils"
import type { PostWithAuthor } from "@/types"
import { unstable_cache } from "next/cache"
import { unstable_noStore } from "next/cache"

// Enable router cache for SPA-like navigation
// Setting revalidate allows Next.js router cache to work, making navigation back to homepage instant
// Router cache stores the rendered page in memory for fast client-side navigation
export const revalidate = 60 // Revalidate every 60 seconds - enables router cache for instant navigation

// Cache platform settings (rarely changes) for 5 minutes
// Uses public client (no cookies) so it can be used in unstable_cache
const getCachedPlatformSettings = unstable_cache(
  async () => {
    const supabase = createPublicSupabaseClient()
    const { data } = await supabase
      .from('platform_settings')
      .select('payout_minimum_ttd, user_value_per_point, user_goal')
      .single()
    return data
  },
  ['platform-settings'],
  { revalidate: 300, tags: ['platform-settings'] }
)

// Cache user count (changes infrequently) for 2 minutes
// Uses public client (no cookies) so it can be used in unstable_cache
const getCachedUserCount = unstable_cache(
  async () => {
    const supabase = createPublicSupabaseClient()
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
    return count ?? 0
  },
  ['user-count'],
  { revalidate: 120, tags: ['user-count'] }
)

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  
  // Fetch user-specific data (no cache) and cached data in parallel
  // This allows router cache to work while still getting fresh user data
  const [userResult, settingsResult, userCountResult, postsResult] = await Promise.all([
    // Get user (user-specific, no cache)
    supabase.auth.getUser(),
    // Get platform settings (cached for 5 minutes)
    getCachedPlatformSettings(),
    // Get total user count (cached for 2 minutes)
    getCachedUserCount(),
    // Fetch posts from all active communities (always fresh, no cache)
    (async () => {
      unstable_noStore() // Mark this fetch as non-cacheable
      const { data, error } = await supabase
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
        .limit(100) // Reduced from 200 - we only show 50 per tab anyway
      return { data, error }
    })()
  ])
  
  const { data: { user } } = userResult
  const settings = settingsResult
  const totalUsers = userCountResult
  const { data: posts, error: postsError } = postsResult
  
  // Calculate payout and user goal settings (needed for early return)
  const payoutMinimumTtd = Number(settings?.payout_minimum_ttd ?? 100)
  const userValuePerPoint = Number(settings?.user_value_per_point ?? 1)
  const minimumPayoutPoints = userValuePerPoint > 0 
    ? Math.ceil(payoutMinimumTtd / userValuePerPoint)
    : 0
  const userGoal = Number(settings?.user_goal ?? 100)
  const currentUserCount = totalUsers ?? 0
  
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
  
  // Parallel fetch all enrichment data: boost counts, recent boosts, author totals, author earnings, and user boost status
  const [
    boostCountsResult,
    recentBoostsResult,
    authorTotalsResult,
    authorEarningsResult,
    userBoostStatusResult
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
      .in('user_id', authorIds),
    // Get user boost status if authenticated (parallel with other queries)
    user && postIds.length > 0
      ? supabase.rpc('get_user_boosted_posts', {
          p_post_ids: postIds,
          p_user_id: user.id
        })
      : Promise.resolve({ data: [] })
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
  
  type BoostStatus = {
    user_has_boosted: boolean
    can_unboost: boolean
  }
  
  const boostStatusMap = new Map<string, BoostStatus>(
    (userBoostStatusResult.data || []).map((b: { post_id: string; user_has_boosted: boolean; can_unboost: boolean }) => [
      b.post_id,
      { user_has_boosted: b.user_has_boosted, can_unboost: b.can_unboost }
    ])
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
  
  const finalPosts: EnrichedPost[] = posts.map(post => {
    const boostCount = boostCountMap.get(post.id) || 0
    const recentBoosts = recentBoostsMap.get(post.id) || 0
    const postDate = new Date(post.published_at || post.created_at)
    const postAgeHours = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60)
    
    // Calculate discovery score: (recent_boosts * 3) + total_boosts + recency_factor
    const recencyFactor = 100 / (postAgeHours + 1)
    const discoveryScore = (recentBoosts * 3) + boostCount + recencyFactor
    
    // Get author data
    const authorTotalBoosts = authorTotalsMap.get(post.author_id) || 0
    const authorEarnings = authorEarningsMap.get(post.author_id) || 0
    const pointsToPayout = Math.max(0, minimumPayoutPoints - Number(authorEarnings))
    const isNearPayout = pointsToPayout > 0 && pointsToPayout <= 20
    
    // Extract community data (could be nested as 'community' or 'communities')
    const communityData = (post as any).community || (post as any).communities
    
    // Get user boost status
    const boostStatus = boostStatusMap.get(post.id) ?? { user_has_boosted: false, can_unboost: false }
    
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
      user_has_boosted: boostStatus.user_has_boosted,
      can_unboost: boostStatus.can_unboost,
      community: communityData ? {
        id: communityData.id,
        name: communityData.name,
        slug: communityData.slug,
        logo_url: communityData.logo_url
      } : undefined
    } as EnrichedPost
  })
  
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