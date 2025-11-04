import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
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
  
  // Fetch community data - use maybeSingle() to avoid error when no rows found
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
    console.error('Error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    notFound()
  }

  if (!community) {
    console.error('No community found for slug:', slug)
    notFound()
  }

  // Check if user is authenticated and get their membership status
  const { data: { user } } = await supabase.auth.getUser()
  
  let userMembership = null
  
  if (user) {
    // Check if user is a member
    const membership = community.members?.find((m: any) => m.user.id === user.id)
    if (membership) {
      userMembership = membership
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