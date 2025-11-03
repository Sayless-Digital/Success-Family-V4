import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import StreamView from "./stream-view"

interface StreamPageProps {
  params: Promise<{
    slug: string
    eventId: string
  }>
}

export default async function StreamPage({ params }: StreamPageProps) {
  const { slug, eventId } = await params
  const supabase = await createServerSupabaseClient()
  
  // Fetch community
  const { data: community } = await supabase
    .from('communities')
    .select('id, name, slug, owner_id')
    .eq('slug', slug)
    .single()

  if (!community) {
    notFound()
  }

  // Fetch event
  const { data: event } = await supabase
    .from('community_events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (!event || event.community_id !== community.id) {
    notFound()
  }

  // Get user
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    notFound() // Should redirect to auth, but for now just 404
  }

  // Get user profile
  const { data: userProfile } = await supabase
    .from('users')
    .select('first_name, last_name, username, profile_picture')
    .eq('id', user.id)
    .single()

  // Build full name from first and last name
  const userName = userProfile
    ? `${userProfile.first_name} ${userProfile.last_name}`.trim() || userProfile.username || 'User'
    : 'User'

  // Check if user is owner or registered
  const isOwner = event.owner_id === user.id
  const { data: registration } = await supabase
    .from('event_registrations')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .is('cancelled_at', null)
    .single()

  const isRegistered = !!registration

  // TEMPORARILY DISABLED: Allow anyone to join live streams
  // if (!isOwner && !isRegistered && event.status === 'scheduled') {
  //   notFound() // Can't join if not registered and event isn't live yet
  // }

  // Get Stream API key
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('stream_start_cost, stream_join_cost')
    .eq('id', 1)
    .single()

  return (
    <StreamView
      event={event}
      community={community}
      currentUserId={user.id}
      currentUserName={userName}
      currentUserImage={userProfile?.profile_picture}
      isOwner={isOwner}
      registrationId={registration?.id}
    />
  )
}

