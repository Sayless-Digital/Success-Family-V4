import { notFound, redirect } from "next/navigation"
import { headers } from "next/headers"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getCommunityBySlug } from "@/lib/community-cache"
import CommunityView from "./community-view"

interface CommunityPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function CommunityPage({ params }: CommunityPageProps) {
  const { slug } = await params
  
  // Early return for static assets that shouldn't be treated as community slugs
  // Common static file extensions that browsers request
  const staticFileExtensions = ['.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.txt', '.xml', '.json']
  const isStaticFile = staticFileExtensions.some(ext => slug.toLowerCase().endsWith(ext))
  
  if (isStaticFile) {
    notFound()
  }
  
  const supabase = await createServerSupabaseClient()
  
  // Fetch community data (always fresh) - needs full data with members for home page
  const communityBasic = await getCommunityBySlug(slug)
  if (!communityBasic) {
    notFound()
  }

  // Fetch full community data with members (only for home page)
  const { data: community, error } = await supabase
    .from('communities')
    .select(`
      *,
      owner:users!communities_owner_id_fkey(id, username, first_name, last_name, profile_picture),
      members:community_members(
        id,
        role,
        joined_at,
        user:users(id, username, first_name, last_name, profile_picture)
      )
    `)
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error('Community fetch error:', JSON.stringify(error, null, 2))
    notFound()
  }

  if (!community) {
    notFound()
  }

  // Check if user is authenticated and get their membership status
  const { data: { user } } = await supabase.auth.getUser()
  
  let userMembership = null
  let isMember = false
  let isOwner = false
  
  if (user) {
    // Check if user is the owner
    isOwner = community.owner_id === user.id
    
    // Check if user is a member
    const membership = community.members?.find((m: any) => m.user.id === user.id)
    if (membership) {
      userMembership = membership
      isMember = true
    }
  }

  // If user is a member or owner, redirect them to the feed
  // BUT only if navigating from outside the community (not already on a community page)
  if (isMember || isOwner) {
    const headersList = await headers()
    const referer = headersList.get('referer') || ''
    
    // Check if referer contains the same community slug
    // If it does, user is navigating within the community, so don't redirect
    const isNavigatingWithinCommunity = referer.includes(`/${slug}/`)
    
    // Only redirect if coming from outside the community
    if (!isNavigatingWithinCommunity) {
      redirect(`/${slug}/feed`)
    }
  }

  return (
    <CommunityView 
      community={community} 
      userMembership={userMembership}
      currentUserId={user?.id}
    />
  )
}