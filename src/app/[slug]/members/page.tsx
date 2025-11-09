import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getCommunityBySlug } from "@/lib/community-cache"
import CommunityMembersView from "./members-view"
import { TopUpGuard } from "@/components/topup-guard"

interface CommunityMembersPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function CommunityMembersPage({ params }: CommunityMembersPageProps) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()
  
  // Fetch community data (cached)
  const community = await getCommunityBySlug(slug)
  if (!community) {
    notFound()
  }

  // Parallel fetch: members and user data
  const [membersResult, userResult] = await Promise.all([
    // Fetch all members
    supabase
      .from('community_members')
      .select(`
        id,
        role,
        joined_at,
        user:users(id, username, first_name, last_name, profile_picture, bio)
      `)
      .eq('community_id', community.id)
      .order('joined_at', { ascending: true }),
    // Get user
    supabase.auth.getUser()
  ])

  const { data: membersData, error: membersError } = membersResult
  const { data: { user } } = userResult

  if (membersError) {
    console.error('Error fetching members:', membersError)
  }

  // Transform members to ensure user is an object, not an array
  const members = membersData?.map((member: any) => ({
    ...member,
    user: Array.isArray(member.user) ? member.user[0] : member.user
  })) || []

  // Check if user is authenticated and get their membership status
  let userMembership = null
  let isOwner = false
  
  if (user) {
    isOwner = community.owner_id === user.id
    userMembership = members.find((m: any) => m.user?.id === user.id) || null
  }

  return (
    <TopUpGuard communitySlug={slug}>
      <CommunityMembersView
        community={community}
        members={members || []}
        userMembership={userMembership}
        isOwner={isOwner}
        currentUserId={user?.id}
      />
    </TopUpGuard>
  )
}

