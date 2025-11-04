import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import CommunityEventsView from "./events-view"

interface CommunityEventsPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function CommunityEventsPage({ params }: CommunityEventsPageProps) {
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

  // Fetch events
  const { data: events, error: eventsError } = await supabase
    .from('community_events')
    .select(`
      *,
      owner:users!community_events_owner_id_fkey(id, username, first_name, last_name, profile_picture)
    `)
    .eq('community_id', community.id)
    .order('scheduled_at', { ascending: true })

  // Fetch registration counts for each event
  const eventsWithCounts = await Promise.all(
    (events || []).map(async (event) => {
      const { count } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .is('cancelled_at', null)
      
      return {
        ...event,
        registration_count: (count as number) || 0,
      }
    })
  )

  if (eventsError) {
    console.error('Error fetching events:', eventsError)
  }

  // Get platform settings for pricing
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('stream_start_cost, stream_join_cost')
    .eq('id', 1)
    .maybeSingle()

  // Check if user is authenticated and get their membership status
  const { data: { user } } = await supabase.auth.getUser()
  
  let isOwner = false
  let userRegistrations: string[] = []
  
  if (user) {
    isOwner = community.owner_id === user.id
    
    // Get user's registrations for these events
    if (events && events.length > 0) {
      const eventIds = events.map(e => e.id)
      const { data: registrations } = await supabase
        .from('event_registrations')
        .select('event_id')
        .eq('user_id', user.id)
        .in('event_id', eventIds)
        .is('cancelled_at', null)
      
      userRegistrations = registrations?.map(r => r.event_id) || []
    }
  }

  return (
    <CommunityEventsView 
      community={community}
      events={eventsWithCounts || []}
      isOwner={isOwner}
      currentUserId={user?.id}
      userRegistrations={userRegistrations}
      streamStartCost={settings?.stream_start_cost || 1}
      streamJoinCost={settings?.stream_join_cost || 1}
    />
  )
}

