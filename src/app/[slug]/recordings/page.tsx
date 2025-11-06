import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import CommunityRecordingsView from "./recordings-view"

interface CommunityRecordingsPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function CommunityRecordingsPage({ params }: CommunityRecordingsPageProps) {
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

  // Fetch recordings for this community
  const { data: recordings, error: recordingsError } = await supabase
    .from('event_recordings')
    .select(`
      *,
      event:community_events(
        id,
        scheduled_at,
        started_at,
        ended_at,
        description,
        owner:users!community_events_owner_id_fkey(id, username, first_name, last_name)
      )
    `)
    .eq('community_id', community.id)
    .order('created_at', { ascending: false })

  if (recordingsError) {
    console.error('Error fetching recordings:', recordingsError)
  }

  // Check if user is authenticated and get their membership status
  const { data: { user } } = await supabase.auth.getUser()
  
  let isOwner = false
  let isMember = false
  
  if (user) {
    isOwner = community.owner_id === user.id
    
    // Check if user is a member
    const { data: membership } = await supabase
      .from('community_members')
      .select('id')
      .eq('community_id', community.id)
      .eq('user_id', user.id)
      .maybeSingle()
    
    isMember = !!membership
  }

  // Only owners and members can view recordings
  if (!isOwner && !isMember) {
    notFound()
  }

  return (
    <CommunityRecordingsView 
      community={community}
      recordings={recordings || []}
      isOwner={isOwner}
      currentUserId={user?.id}
    />
  )
}

