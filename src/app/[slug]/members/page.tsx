import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import CommunityMembersView from "./members-view"

interface CommunityMembersPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function CommunityMembersPage({ params }: CommunityMembersPageProps) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()
  
  // Fetch community data
  const { data: community, error } = await supabase
    .from('communities')
    .select(`
      id,
      name,
      slug,
      description,
      owner_id,
      owner:users!communities_owner_id_fkey(id, username, first_name, last_name, profile_picture)
    `)
    .eq('slug', slug)
    .single()

  if (error || !community) {
    notFound()
  }

  // Fetch all members
  const { data: membersData, error: membersError } = await supabase
    .from('community_members')
    .select(`
      id,
      role,
      joined_at,
      user:users(id, username, first_name, last_name, profile_picture, bio)
    `)
    .eq('community_id', community.id)
    .order('joined_at', { ascending: true })

  if (membersError) {
    console.error('Error fetching members:', membersError)
  }

  // Transform members to ensure user is an object, not an array
  const members = membersData?.map((member: any) => ({
    ...member,
    user: Array.isArray(member.user) ? member.user[0] : member.user
  })) || []

  // Check if user is authenticated and get their membership status
  const { data: { user } } = await supabase.auth.getUser()
  
  let userMembership = null
  let isOwner = false
  
  if (user) {
    isOwner = community.owner_id === user.id
    userMembership = members.find((m: any) => m.user?.id === user.id) || null
  }

  return (
    <CommunityMembersView 
      community={community}
      members={members || []}
      userMembership={userMembership}
      isOwner={isOwner}
      currentUserId={user?.id}
    />
  )
}

