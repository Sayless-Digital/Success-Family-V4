import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import StreamView from "./stream-view"
import { StreamErrorBoundary } from "./error-boundary"

interface StreamPageProps {
  params: Promise<{
    slug: string
    eventId: string
  }>
}

export default async function StreamPage({ params }: StreamPageProps) {
  const { slug, eventId } = await params
  const supabase = await createServerSupabaseClient()
  
  // Fetch community - use maybeSingle() to avoid error when no rows found
  const { data: community, error: communityError } = await supabase
    .from('communities')
    .select('id, name, slug, owner_id')
    .eq('slug', slug)
    .maybeSingle()

  if (communityError) {
    console.error('Community fetch error:', communityError)
    notFound()
  }

  if (!community) {
    console.error('Community not found for slug:', slug)
    notFound()
  }

  // Fetch event - use maybeSingle() to avoid error when no rows found
  const { data: event, error: eventError } = await supabase
    .from('community_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle()

  if (eventError) {
    console.error('Event fetch error:', eventError)
    notFound()
  }

  if (!event || event.community_id !== community.id) {
    console.error('Event not found or does not belong to community:', { eventId, communityId: community.id })
    notFound()
  }

  // Get user
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    notFound() // Should redirect to auth, but for now just 404
  }

  // Get user profile - use maybeSingle() to avoid error when no rows found
  const { data: userProfile } = await supabase
    .from('users')
    .select('first_name, last_name, username, profile_picture')
    .eq('id', user.id)
    .maybeSingle()

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
    .maybeSingle()

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
    .maybeSingle()

  return (
    <StreamErrorBoundary communitySlug={community.slug}>
      <StreamView
        event={event}
        community={community}
        currentUserId={user.id}
        currentUserName={userName}
        currentUserImage={userProfile?.profile_picture}
        isOwner={isOwner}
        registrationId={registration?.id}
      />
    </StreamErrorBoundary>
  )
}

