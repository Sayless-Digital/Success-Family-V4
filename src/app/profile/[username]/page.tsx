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
    .single()

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

  // Fetch user's posts with media and community
  const { data: userPosts } = await supabase
    .from('posts')
    .select(`
      *,
      post_media (*),
      communities!posts_community_id_fkey (slug, name)
    `)
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })

  // Get current user for boost status
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  // Enrich posts with boost counts, boost status, and attach media
  const postsWithData: (Post & { media?: PostMedia[] })[] = await Promise.all(
    (userPosts || []).map(async (post: any) => {
      // Get boost count using RPC
      const { data: boostCount } = await supabase
        .rpc('get_post_boost_count', { p_post_id: post.id })
      
      // Get media sorted by display_order
      const media = (post.post_media || []).sort((a: PostMedia, b: PostMedia) => 
        a.display_order - b.display_order
      )

      // Check if current user has boosted this post
      let userHasBoosted = false
      let canUnboost = false

      if (currentUser) {
        const { data: boostData } = await supabase
          .from('post_boosts')
          .select('id')
          .eq('post_id', post.id)
          .eq('user_id', currentUser.id)
          .maybeSingle()

        userHasBoosted = !!boostData

        if (userHasBoosted) {
          // Check if user can unboost (within 1 minute)
          const { data: canUnboostData } = await supabase
            .rpc('can_unboost_post', {
              p_post_id: post.id,
              p_user_id: currentUser.id
            })
          canUnboost = canUnboostData || false
        }
      }

      return {
        ...post,
        boost_count: boostCount || 0,
        media: media.length > 0 ? media : undefined,
        community_slug: post.communities?.slug,
        community_name: post.communities?.name,
        user_has_boosted: userHasBoosted,
        can_unboost: canUnboost
      }
    })
  )

  // Fetch posts user has boosted
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
    .order('created_at', { ascending: false })

  // Transform boosted posts data with boost counts (posts user boosted)
  const boostedPosts: (Post & { media?: PostMedia[], author?: User })[] = await Promise.all(
    (boostedPostsData || [])
      .filter((boost: any) => boost.posts)
      .map(async (boost: any) => {
        const post = boost.posts
        
        // Get boost count using RPC
        const { data: boostCount } = await supabase
          .rpc('get_post_boost_count', { p_post_id: post.id })
        
        const media = (post.post_media || []).sort((a: PostMedia, b: PostMedia) => 
          a.display_order - b.display_order
        )

        // All posts in this list are boosted by the profile owner
        let canUnboost = false
        if (currentUser && currentUser.id === user.id) {
          // Check if user can unboost (within 1 minute)
          const { data: canUnboostData } = await supabase
            .rpc('can_unboost_post', {
              p_post_id: post.id,
              p_user_id: currentUser.id
            })
          canUnboost = canUnboostData || false
        }

        return {
          ...post,
          boost_count: boostCount || 0,
          media: media.length > 0 ? media : undefined,
          author: post.author,
          community_slug: post.communities?.slug,
          community_name: post.communities?.name,
          user_has_boosted: currentUser?.id === user.id, // Only true if viewing own profile
          can_unboost: canUnboost
        }
      })
  )

  // Fetch user's posts that have been boosted by others
  const { data: boostedUserPostsData } = await supabase
    .from('posts')
    .select(`
      *,
      post_media (*),
      communities!posts_community_id_fkey (slug, name)
    `)
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })

  // Filter to only posts that have boosts (have been boosted by others)
  const userPostsWithBoosts = await Promise.all(
    (boostedUserPostsData || []).map(async (post: any) => {
      const { data: boostCount } = await supabase
        .rpc('get_post_boost_count', { p_post_id: post.id })
      
      if (boostCount === 0 || boostCount === null) return null

      const media = (post.post_media || []).sort((a: PostMedia, b: PostMedia) => 
        a.display_order - b.display_order
      )

      // Check if current user has boosted this post
      let userHasBoosted = false
      let canUnboost = false

      if (currentUser) {
        const { data: boostData } = await supabase
          .from('post_boosts')
          .select('id')
          .eq('post_id', post.id)
          .eq('user_id', currentUser.id)
          .maybeSingle()

        userHasBoosted = !!boostData

        if (userHasBoosted) {
          // Check if user can unboost (within 1 minute)
          const { data: canUnboostData } = await supabase
            .rpc('can_unboost_post', {
              p_post_id: post.id,
              p_user_id: currentUser.id
            })
          canUnboost = canUnboostData || false
        }
      }

      return {
        ...post,
        boost_count: boostCount || 0,
        media: media.length > 0 ? media : undefined,
        community_slug: post.communities?.slug,
        community_name: post.communities?.name,
        user_has_boosted: userHasBoosted,
        can_unboost: canUnboost
      }
    })
  )

  // Filter out nulls (posts with no boosts)
  const gotBoostedPosts = userPostsWithBoosts.filter(Boolean) as (Post & { media?: PostMedia[] })[]

  // Fetch saved posts (only if viewing own profile or if we have access)
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

  // Transform saved posts data with boost counts
  const savedPosts: (Post & { media?: PostMedia[], author?: User })[] = await Promise.all(
    (savedPostsData || [])
      .filter((saved: any) => saved.posts)
      .map(async (saved: any) => {
        const post = saved.posts
        
        // Get boost count using RPC
        const { data: boostCount } = await supabase
          .rpc('get_post_boost_count', { p_post_id: post.id })
        
        const media = (post.post_media || []).sort((a: PostMedia, b: PostMedia) => 
          a.display_order - b.display_order
        )

        // Check if current user has boosted this post
        let userHasBoosted = false
        let canUnboost = false

        if (currentUser) {
          const { data: boostData } = await supabase
            .from('post_boosts')
            .select('id')
            .eq('post_id', post.id)
            .eq('user_id', currentUser.id)
            .maybeSingle()

          userHasBoosted = !!boostData

          if (userHasBoosted) {
            // Check if user can unboost (within 1 minute)
            const { data: canUnboostData } = await supabase
              .rpc('can_unboost_post', {
                p_post_id: post.id,
                p_user_id: currentUser.id
              })
            canUnboost = canUnboostData || false
          }
        }

        return {
          ...post,
          boost_count: boostCount || 0,
          media: media.length > 0 ? media : undefined,
          author: post.author,
          community_slug: post.communities?.slug,
          community_name: post.communities?.name,
          user_has_saved: true, // All saved posts are saved by definition
          user_has_boosted: userHasBoosted,
          can_unboost: canUnboost
        }
      })
  )

  // Fetch communities user is a member of
  const { data: communitiesData } = await supabase
    .from('community_members')
    .select(`
      communities (
        id,
        name,
        slug,
        description,
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
      boostedPosts={boostedPosts}
      gotBoostedPosts={gotBoostedPosts}
      savedPosts={savedPosts}
      communities={communities}
    />
  )
}

