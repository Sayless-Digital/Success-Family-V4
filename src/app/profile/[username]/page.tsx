import { createServerSupabaseClient } from "@/lib/supabase-server"
import { notFound, redirect } from "next/navigation"
import ProfileView from "./profile-view"
import type { Post, PostMedia, User } from "@/types"

interface PageProps {
  params: Promise<{ username: string }>
}

export default async function ProfilePage(props: PageProps) {
  const params = await props.params
  const username = params.username
  
  if (!username) {
    redirect('/')
  }

  const supabase = await createServerSupabaseClient()

  // Fetch user profile by username
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .maybeSingle()

  if (error || !user) {
    notFound()
  }

  // Count user's communities (as owner)
  const { count: ownedCommunitiesCount } = await supabase
    .from('communities')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', user.id)
    .eq('is_active', true)

  // Count user's community memberships
  const { count: memberCommunitiesCount } = await supabase
    .from('community_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Count user's verified payments
  const { count: verifiedPaymentsCount } = await supabase
    .from('payment_receipts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'verified')

  // Get current user for boost status
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  // Helper function to enrich posts with batch queries
  const enrichPostsWithBatchQueries = async (posts: any[]) => {
    if (!posts || posts.length === 0) return []
    
    const postIds = posts.map(p => p.id)
    
    // Batch fetch boost counts
    const { data: boostCountsData } = await supabase
      .rpc('get_posts_boost_counts', { p_post_ids: postIds })

    // Batch fetch user boost status if authenticated
    let userBoostStatus: Array<{ post_id: string; user_has_boosted: boolean; can_unboost: boolean }> = []
    if (currentUser) {
      const { data: boostStatusData } = await supabase
        .rpc('get_user_boosted_posts', { 
          p_post_ids: postIds,
          p_user_id: currentUser.id 
        })
      userBoostStatus = boostStatusData || []
    }

    // Create lookup maps
    const boostCountMap = new Map(
      (boostCountsData || []).map((b: { post_id: string; boost_count: number }) => [b.post_id, b.boost_count])
    )
    const boostStatusMap = new Map(
      userBoostStatus.map((b: { post_id: string; user_has_boosted: boolean; can_unboost: boolean }) => [b.post_id, { user_has_boosted: b.user_has_boosted, can_unboost: b.can_unboost }])
    )

    // Enrich posts
    return posts.map((post: any) => {
      const boostCount = boostCountMap.get(post.id) || 0
      const boostStatus = boostStatusMap.get(post.id) || { user_has_boosted: false, can_unboost: false }
      
      // Get media sorted by display_order
      const media = (post.post_media || []).sort((a: PostMedia, b: PostMedia) => 
        a.display_order - b.display_order
      )

      return {
        ...post,
        boost_count: boostCount,
        media: media.length > 0 ? media : undefined,
        community_slug: post.communities?.slug,
        community_name: post.communities?.name,
        user_has_boosted: boostStatus.user_has_boosted,
        can_unboost: boostStatus.can_unboost
      }
    })
  }

  // Fetch initial 20 user's posts with media and community
  const { data: userPosts } = await supabase
    .from('posts')
    .select(`
      *,
      post_media (*),
      communities!posts_community_id_fkey (slug, name)
    `)
    .eq('author_id', user.id)
    .eq('depth', 0)
    .order('created_at', { ascending: false })
    .limit(20)

  // Enrich posts with batch queries
  const postsWithData = await enrichPostsWithBatchQueries(userPosts || [])

  // Check if there are more posts
  const { count: totalPostsCount } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', user.id)
    .eq('depth', 0)

  const postsHasMore = (totalPostsCount || 0) > 20

  // Fetch initial 20 posts user has boosted
  const { data: boostedPostsData } = await supabase
    .from('post_boosts')
    .select(`
      post_id,
      posts (
        *,
        post_media (*),
        author:users!posts_author_id_fkey (*),
        communities!posts_community_id_fkey (slug, name)
      )
    `)
    .eq('user_id', user.id)
    .eq('posts.depth', 0)
    .order('created_at', { ascending: false })
    .limit(20)

  // Transform boosted posts data
  const boostedPostsRaw = (boostedPostsData || [])
    .filter((boost: any) => boost.posts)
    .map((boost: any) => ({
      ...boost.posts,
      post_media: boost.posts.post_media || [],
      communities: boost.posts.communities
    }))

  // Enrich with batch queries
  const boostedPosts = await enrichPostsWithBatchQueries(boostedPostsRaw)
  
  // Set user_has_boosted and can_unboost for boosted posts (only if viewing own profile)
  const enrichedBoostedPosts = boostedPosts.map((post: any) => {
    const boostStatus = currentUser?.id === user.id 
      ? { user_has_boosted: true, can_unboost: post.can_unboost }
      : { user_has_boosted: false, can_unboost: false }
    
    return {
      ...post,
      ...boostStatus,
      author: boostedPostsRaw.find((p: any) => p.id === post.id)?.author
    }
  }) as (Post & { media?: PostMedia[], author?: User })[]

  // Check if there are more boosted posts
  const { count: totalBoostedCount } = await supabase
    .from('post_boosts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const boostedPostsHasMore = (totalBoostedCount || 0) > 20

  // Fetch user's posts that have been boosted by others
  // First get posts that have boosts using a join
  const { data: postsWithBoosts } = await supabase
    .from('posts')
    .select(`
      *,
      post_media (*),
      communities!posts_community_id_fkey (slug, name),
      post_boosts!inner(post_id)
    `)
    .eq('author_id', user.id)
    .eq('depth', 0)
    .order('created_at', { ascending: false })
    .limit(100) // Fetch more to account for filtering

  // Get unique posts (join creates duplicates)
  const uniquePostsWithBoosts = Array.from(
    new Map((postsWithBoosts || []).map((p: any) => [p.id, p])).values()
  ).slice(0, 20) // Take first 20 after deduplication

  // Enrich with batch queries
  const gotBoostedPostsRaw = await enrichPostsWithBatchQueries(uniquePostsWithBoosts)
  
  // Filter to only those with boost_count > 0 (should all have > 0 but double-check)
  const gotBoostedPosts = gotBoostedPostsRaw.filter((p: any) => (p.boost_count || 0) > 0) as (Post & { media?: PostMedia[] })[]

  // Check if there are more - count posts with boosts
  const { count: totalGotBoostedCount } = await supabase
    .from('posts')
    .select(`
      id,
      post_boosts!inner(post_id)
    `, { count: 'exact', head: false })
    .eq('author_id', user.id)

  const gotBoostedPostsHasMore = (totalGotBoostedCount || 0) > 20

  // Fetch initial 20 saved posts (only if viewing own profile or if we have access)
  const { data: savedPostsData } = await supabase
    .from('saved_posts')
    .select(`
      post_id,
      posts (
        *,
        post_media (*),
        author:users!posts_author_id_fkey (*),
        communities!posts_community_id_fkey (slug, name)
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Transform saved posts data
  const savedPostsRaw = (savedPostsData || [])
    .filter((saved: any) => saved.posts)
    .map((saved: any) => ({
      ...saved.posts,
      post_media: saved.posts.post_media || [],
      communities: saved.posts.communities,
      author: saved.posts.author
    }))

  // Enrich with batch queries
  const savedPosts = await enrichPostsWithBatchQueries(savedPostsRaw)
  
  // Add saved flag and author info
  const enrichedSavedPosts = savedPosts.map((post: any) => ({
    ...post,
    user_has_saved: true, // All saved posts are saved by definition
    author: savedPostsRaw.find((p: any) => p.id === post.id)?.author
  })) as (Post & { media?: PostMedia[], author?: User })[]

  // Check if there are more saved posts
  const { count: totalSavedCount } = await supabase
    .from('saved_posts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const savedPostsHasMore = (totalSavedCount || 0) > 20

  // Fetch communities user is a member of
  const { data: communitiesData } = await supabase
    .from('community_members')
    .select(`
      communities (
        id,
        name,
        slug,
        description,
        logo_url,
        is_active,
        created_at
      )
    `)
    .eq('user_id', user.id)

  const communities = (communitiesData || [])
    .map((cm: any) => cm.communities)
    .filter(Boolean)

  return (
    <ProfileView
      user={user}
      ownedCommunitiesCount={ownedCommunitiesCount || 0}
      memberCommunitiesCount={memberCommunitiesCount || 0}
      verifiedPaymentsCount={verifiedPaymentsCount || 0}
      posts={postsWithData}
      postsHasMore={postsHasMore}
      boostedPosts={enrichedBoostedPosts}
      boostedPostsHasMore={boostedPostsHasMore}
      gotBoostedPosts={gotBoostedPosts}
      gotBoostedPostsHasMore={gotBoostedPostsHasMore}
      savedPosts={enrichedSavedPosts}
      savedPostsHasMore={savedPostsHasMore}
      communities={communities}
    />
  )
}

