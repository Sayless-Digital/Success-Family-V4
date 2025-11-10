import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getCommunityBySlug } from "@/lib/community-cache"
import CommunityEventsView from "./events-view"
import { TopUpGuard } from "@/components/topup-guard"

interface CommunityEventsPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function CommunityEventsPage({ params }: CommunityEventsPageProps) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()
  
  // Fetch community data (always fresh)
  const community = await getCommunityBySlug(slug)
  if (!community) {
    notFound()
  }

  // Parallel fetch: events, settings, and user data
  const [eventsResult, settingsResult, userResult] = await Promise.all([
    // Fetch events
    supabase
      .from('community_events')
      .select(`
        *,
        owner:users!community_events_owner_id_fkey(id, username, first_name, last_name, profile_picture)
      `)
      .eq('community_id', community.id)
      .order('scheduled_at', { ascending: true }),
    // Get platform settings for pricing
    supabase
      .from('platform_settings')
      .select('stream_start_cost, stream_join_cost')
      .eq('id', 1)
      .maybeSingle(),
    // Get user
    supabase.auth.getUser()
  ])

  const { data: events, error: eventsError } = eventsResult
  const { data: settings } = settingsResult
  const { data: { user } } = userResult

  if (eventsError) {
    console.error('Error fetching events:', eventsError)
  }

  // Batch fetch registration counts for all events at once (instead of N queries)
  let eventsWithCounts = events || []
  let userRegistrations: string[] = []
  
  if (events && events.length > 0) {
    const eventIds = events.map(e => e.id)
    
    // Parallel fetch: registration counts and user registrations
    const [countsResult, registrationsResult] = await Promise.all([
      // Batch fetch all registration counts using a single query per event
      // Use a more efficient approach: fetch all registrations and count in memory
      supabase
        .from('event_registrations')
        .select('event_id')
        .in('event_id', eventIds)
        .is('cancelled_at', null),
      // Get user's registrations
      user
        ? supabase
            .from('event_registrations')
            .select('event_id')
            .eq('user_id', user.id)
            .in('event_id', eventIds)
            .is('cancelled_at', null)
        : Promise.resolve({ data: [] })
    ])

    // Count registrations per event
    const allRegistrations = countsResult.data || []
    const registrationCounts = new Map<string, number>()
    allRegistrations.forEach((reg: any) => {
      registrationCounts.set(reg.event_id, (registrationCounts.get(reg.event_id) || 0) + 1)
    })

    // Get user registrations
    const { data: registrations } = registrationsResult
    userRegistrations = registrations?.map((r: any) => r.event_id) || []

    // Add counts to events
    eventsWithCounts = events.map((event) => ({
      ...event,
      registration_count: registrationCounts.get(event.id) || 0,
    }))
  }

  const isOwner = user ? community.owner_id === user.id : false

  return (
    <TopUpGuard communitySlug={slug}>
      <CommunityEventsView
        community={community}
        events={eventsWithCounts || []}
        isOwner={isOwner}
        currentUserId={user?.id}
        userRegistrations={userRegistrations}
        streamStartCost={settings?.stream_start_cost || 1}
        streamJoinCost={settings?.stream_join_cost || 1}
      />
    </TopUpGuard>
  )
}

