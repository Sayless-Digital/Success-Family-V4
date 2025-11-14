"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Video, Calendar, Clock, Users, Play, Plus, X, Trash2, Edit, MoreVertical, Crown } from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { CommunityNavigation } from "@/components/community-navigation"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CustomDateTimePicker } from "@/components/ui/custom-date-time-picker"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import type { CommunityEvent, EventStatus } from "@/types"
import { cn } from "@/lib/utils"

// Helper function for date formatting
function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

interface CommunityEventsViewProps {
  community: {
    id: string
    name: string
    slug: string
    owner_id: string
  }
  events: Array<CommunityEvent & {
    registration_count?: number
    owner?: {
      id: string
      username: string
      first_name: string
      last_name: string
      profile_picture?: string
    }
  }>
  isOwner: boolean
  isMember: boolean
  currentUserId?: string
  userRegistrations: string[]
  streamStartCost: number
  streamJoinCost: number
}

export default function CommunityEventsView({
  community,
  events: initialEvents,
  isOwner,
  isMember,
  currentUserId,
  userRegistrations: initialUserRegistrations,
  streamStartCost,
  streamJoinCost,
}: CommunityEventsViewProps) {
  const router = useRouter()
  const { user, userProfile, walletBalance, walletEarningsBalance, refreshWalletBalance } = useAuth()
  const [events, setEvents] = useState(initialEvents)
  const [userRegistrations, setUserRegistrations] = useState(initialUserRegistrations)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Create event form state
  const [createStep, setCreateStep] = useState<1 | 2>(1)
  const [eventDescription, setEventDescription] = useState("")
  const [eventDate, setEventDate] = useState<Date>(new Date())
  const [eventTime, setEventTime] = useState<string | null>(null)

  // Generate time slots (12:00 AM to 11:30 PM in 30-minute intervals - all 24 hours)
  const generateTimeSlots = () => {
    const slots = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        slots.push({ time: timeString, available: true })
      }
    }
    return slots
  }
  const timeSlots = generateTimeSlots()

  // Realtime subscription for events
  React.useEffect(() => {
    if (!community?.id) return

    const channel = supabase
      .channel(`community-events-${community.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'community_events',
          filter: `community_id=eq.${community.id}`
        },
        async (payload) => {
          console.log('Events realtime event:', payload.eventType, payload)
          
          if (payload.eventType === 'INSERT') {
            // Fetch the new event with all related data
            const { data: newEvent, error: fetchError } = await supabase
              .from('community_events')
              .select(`
                *,
                owner:users!community_events_owner_id_fkey(id, username, first_name, last_name, profile_picture)
              `)
              .eq('id', payload.new.id)
              .single()

            if (fetchError) {
              console.error('Error fetching new event:', fetchError)
              return
            }

            if (newEvent) {
              // Get registration count
              const { count } = await supabase
                .from('event_registrations')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', newEvent.id)
                .is('cancelled_at', null)

              setEvents((prev) => {
                // Check if event already exists (to prevent duplicates)
                if (prev.find(e => e.id === newEvent.id)) {
                  return prev
                }
                return [
                  ...prev,
                  {
                    ...newEvent,
                    owner: newEvent.owner as any,
                    registration_count: count || 0,
                    user_has_registered: false
                  }
                ]
              })
            }
          } else if (payload.eventType === 'UPDATE') {
            // Update existing event
            const updatedEvent = payload.new as any

            // If event was cancelled, remove it from the list (cancelled events are not displayed)
            if (updatedEvent.status === 'cancelled') {
              setEvents((prev) => prev.filter((event) => event.id !== updatedEvent.id))
              return
            }

            setEvents((prev) => {
              return prev.map((event) => {
                if (event.id === updatedEvent.id) {
                  return {
                    ...event,
                    ...updatedEvent,
                    // Preserve existing joined data
                    owner: event.owner,
                    registration_count: event.registration_count,
                    user_has_registered: event.user_has_registered
                  }
                }
                return event
              })
            })

            // Registration counts will be updated via the registrations subscription
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted event
            setEvents((prev) => prev.filter((event) => event.id !== payload.old.id))
          }
        }
      )
      .subscribe((status) => {
        console.log('Events subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to community_events realtime')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to community_events realtime')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [community?.id])

  // Realtime subscription for event registrations (to update counts)
  React.useEffect(() => {
    if (!community?.id) return

    // Get current event IDs to filter in callback
    const eventIds = new Set(events.map(e => e.id))

    const channel = supabase
      .channel(`event-registrations-${community.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_registrations'
        },
        async (payload: any) => {
          const eventId = payload.new?.event_id || payload.old?.event_id

          if (!eventId) return

          // Check if this registration is for one of our events
          // We'll also check by querying the event's community_id to be safe
          const { data: eventData } = await supabase
            .from('community_events')
            .select('id, community_id')
            .eq('id', eventId)
            .single()

          if (!eventData || eventData.community_id !== community.id) {
            return
          }

          // Update registration count for the affected event
          const { count } = await supabase
            .from('event_registrations')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', eventId)
            .is('cancelled_at', null)

          // Update user registrations list
          if (payload.eventType === 'INSERT' && payload.new.user_id === currentUserId) {
            setUserRegistrations((prev) => {
              if (!prev.includes(eventId)) {
                return [...prev, eventId]
              }
              return prev
            })
          } else if (payload.eventType === 'UPDATE' && payload.new.cancelled_at) {
            // Registration was cancelled
            if (payload.new.user_id === currentUserId) {
              setUserRegistrations((prev) => prev.filter(id => id !== eventId))
            }
          }

          // Update event registration count
          setEvents((prev) => {
            return prev.map((event) => {
              if (event.id === eventId) {
                return {
                  ...event,
                  registration_count: count || 0,
                  user_has_registered: payload.eventType === 'INSERT' && payload.new.user_id === currentUserId
                    ? true
                    : event.user_has_registered
                }
              }
              return event
            })
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [community?.id, currentUserId, events.length])

  // Filter events by status
  const scheduledEvents = events.filter(e => e.status === 'scheduled')
  const liveEvents = events.filter(e => e.status === 'live')
  const completedEvents = events.filter(e => e.status === 'completed')
  const cancelledEvents = events.filter(e => e.status === 'cancelled')

  const handleCreateEvent = async () => {
    if (!user || !currentUserId) {
      toast.error("Please sign in to create an event")
      return
    }

    if (!eventDate) {
      toast.error("Please select a date")
      return
    }

    if (!eventTime) {
      toast.error("Please select a time")
      return
    }

    // Combine date and time
    const [hours, minutes] = eventTime.split(':')
    const scheduledAt = new Date(eventDate)
    scheduledAt.setHours(parseInt(hours, 10))
    scheduledAt.setMinutes(parseInt(minutes, 10))
    scheduledAt.setSeconds(0)
    
    if (isNaN(scheduledAt.getTime())) {
      toast.error("Invalid date or time")
      return
    }

    if (scheduledAt < new Date()) {
      toast.error("Event must be scheduled for a future date")
      return
    }

    // Check wallet balance (skip for admins)
    const isAdmin = userProfile?.role === 'admin'
    if (!isAdmin && (walletBalance === null || walletBalance < streamStartCost)) {
      toast.error(`Insufficient points. You need ${streamStartCost} points to create an event.`)
      return
    }

    setIsCreating(true)

    try {
      // Create event first (without charging yet - we'll charge via RPC)
      const { data: newEvent, error: eventError } = await supabase
        .from('community_events')
        .insert({
          community_id: community.id,
          owner_id: currentUserId,
          description: eventDescription.trim() || null,
          scheduled_at: scheduledAt.toISOString(),
          status: 'scheduled',
        })
        .select()
        .single()

      if (eventError) {
        console.error('Event insert error:', eventError)
        throw new Error(eventError.message || `Failed to create event: ${JSON.stringify(eventError)}`)
      }
      if (!newEvent) {
        console.error('Event insert returned no data')
        throw new Error('Failed to create event - no event returned')
      }

      // Charge owner upfront for creating event
      const { data: chargeResult, error: chargeError } = await supabase
        .rpc('deduct_points_for_stream_creation', {
          p_user_id: currentUserId,
          p_event_id: newEvent.id,
          p_point_cost: streamStartCost,
        })

      if (chargeError) {
        console.error('RPC charge error:', chargeError)
        // Rollback event creation
        await supabase.from('community_events').delete().eq('id', newEvent.id)
        throw new Error(chargeError.message || `RPC error: ${JSON.stringify(chargeError)}`)
      }

      if (!chargeResult) {
        console.error('RPC charge returned no result')
        // Rollback event creation
        await supabase.from('community_events').delete().eq('id', newEvent.id)
        throw new Error('Failed to charge points - no transaction ID returned')
      }

      // Show success message (admins bypass point deduction)
      if (isAdmin) {
        toast.success('Event created! (No points charged for admin)')
      } else {
        toast.success(`Event created! ${streamStartCost} point(s) charged.`)
        // Refresh wallet balance for non-admins (admins don't have points deducted)
        await refreshWalletBalance()
      }
      
      // Optimistically add the event to the list immediately (before realtime update)
      // Fetch the event with all related data
      const { data: createdEvent } = await supabase
        .from('community_events')
        .select(`
          *,
          owner:users!community_events_owner_id_fkey(id, username, first_name, last_name, profile_picture)
        `)
        .eq('id', newEvent.id)
        .single()

      if (createdEvent) {
        const { count } = await supabase
          .from('event_registrations')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', createdEvent.id)
          .is('cancelled_at', null)

        setEvents((prev) => {
          // Check if event already exists (to prevent duplicates)
          if (prev.find(e => e.id === createdEvent.id)) {
            return prev
          }
          return [
            ...prev,
            {
              ...createdEvent,
              owner: createdEvent.owner as any,
              registration_count: count || 0,
              user_has_registered: false
            }
          ]
        })
      }

      setCreateDialogOpen(false)
      setCreateStep(1)
      setEventDescription("")
      setEventDate(new Date())
      setEventTime(null)
      
      // Wallet balance already refreshed above for non-admins
    } catch (error: any) {
      console.error('Error creating event:', error)
      const errorMessage = error?.message || error?.error?.message || JSON.stringify(error) || 'Failed to create event'
      console.error('Error details:', {
        message: error?.message,
        error: error?.error,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      })
      toast.error(errorMessage)
    } finally {
      setIsCreating(false)
    }
  }

  const confirmDeleteEvent = async () => {
    if (!deleteDialogOpen || !currentUserId) return

    setIsDeleting(true)

    try {
      // Cancel event and refund all (via RPC)
      const { error } = await supabase
        .rpc('cancel_event_and_refund_all', {
          p_event_id: deleteDialogOpen,
        })

      if (error) throw error

      // Remove from local state (same pattern as posts)
      setEvents((prev) => prev.filter((event) => event.id !== deleteDialogOpen))
      
      toast.success("Event cancelled and all refunds processed")
      setDeleteDialogOpen(null)
      
      // Refresh wallet balance
      await refreshWalletBalance()
    } catch (error: any) {
      console.error('Error deleting event:', error)
      toast.error(error.message || 'Failed to cancel event')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRegisterForEvent = async (eventId: string) => {
    if (!user || !currentUserId) {
      toast.error("Please sign in to register for events")
      return
    }

    // Check combined balance (wallet + earnings)
    const availableBalance = (walletBalance ?? 0) + (walletEarningsBalance ?? 0)
    if (availableBalance < streamJoinCost) {
      toast.error(`Insufficient points. You need ${streamJoinCost} point(s) to join this event.`)
      return
    }

    try {
      // Charge user upfront and transfer to owner
      const { data, error } = await supabase
        .rpc('deduct_points_for_stream_join', {
          p_user_id: currentUserId,
          p_event_id: eventId,
          p_point_cost: streamJoinCost,
        })

      if (error) {
        console.error('RPC error:', error)
        // Check if it's a network error
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
          toast.error('Network error. Please check your connection and try again.')
          return
        }
        throw error
      }

      toast.success(`Registered for event! ${streamJoinCost} point(s) charged.`)
      
      // Update local state
      setUserRegistrations(prev => [...prev, eventId])
      
      // Refresh wallet balance (registration will update via realtime)
      await refreshWalletBalance()
    } catch (error: any) {
      console.error('Error registering for event:', error)
      // Provide more specific error messages
      if (error?.message) {
        toast.error(error.message)
      } else if (error?.code === 'PGRST116' || error?.message?.includes('function') || error?.message?.includes('does not exist')) {
        toast.error('Database function not found. Please ensure the migration has been applied.')
      } else {
        toast.error('Failed to register for event. Please try again.')
      }
    }
  }

  const handleRegisterAndJoin = async (eventId: string) => {
    if (!user || !currentUserId) {
      toast.error("Please sign in to register for events")
      return
    }

    // Check combined balance (wallet + earnings)
    const availableBalance = (walletBalance ?? 0) + (walletEarningsBalance ?? 0)
    if (availableBalance < streamJoinCost) {
      toast.error(`Insufficient points. You need ${streamJoinCost} point(s) to join this event.`)
      return
    }

    try {
      // Charge user upfront and transfer to owner
      const { data, error } = await supabase
        .rpc('deduct_points_for_stream_join', {
          p_user_id: currentUserId,
          p_event_id: eventId,
          p_point_cost: streamJoinCost,
        })

      if (error) {
        console.error('RPC error:', error)
        // Check if it's a network error
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
          toast.error('Network error. Please check your connection and try again.')
          return
        }
        throw error
      }

      toast.success(`Registered and joining stream! ${streamJoinCost} point(s) charged.`)
      
      // Update local state
      setUserRegistrations(prev => [...prev, eventId])
      
      // Refresh wallet balance
      await refreshWalletBalance()
      
      // Navigate to stream immediately
      router.push(`/${community.slug}/events/${eventId}/stream`)
    } catch (error: any) {
      console.error('Error registering and joining:', error)
      // Provide more specific error messages
      if (error?.message) {
        toast.error(error.message)
      } else if (error?.code === 'PGRST116' || error?.message?.includes('function') || error?.message?.includes('does not exist')) {
        toast.error('Database function not found. Please ensure the migration has been applied.')
      } else {
        toast.error('Failed to register and join stream. Please try again.')
      }
    }
  }

  const handleCancelRegistration = async (eventId: string) => {
    if (!currentUserId) return

    try {
      // Find registration ID
      const { data: registration } = await supabase
        .from('event_registrations')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', currentUserId)
        .is('cancelled_at', null)
        .single()

      if (!registration) {
        toast.error("Registration not found")
        return
      }

      // Refund registration
      const { error } = await supabase
        .rpc('refund_event_registration', {
          p_registration_id: registration.id,
          p_refund_reason: 'user_cancelled',
        })

      if (error) throw error

      toast.success("Registration cancelled and refunded")
      
      // Update local state
      setUserRegistrations(prev => prev.filter(id => id !== eventId))
      
      // Refresh wallet balance
      await refreshWalletBalance()
    } catch (error: any) {
      console.error('Error cancelling registration:', error)
      toast.error(error.message || 'Failed to cancel registration')
    }
  }

  const handleGoLive = async (eventId: string) => {
    if (!user || !currentUserId) {
      toast.error("Please sign in to go live")
      return
    }

    const event = events.find(e => e.id === eventId)
    if (!event) {
      toast.error("Event not found")
      return
    }

    try {
      // Create Stream call
      const response = await fetch('/api/stream-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: eventId,
        }),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to create stream'
        try {
          const error = await response.json()
          errorMessage = error.error || errorMessage
          console.error('Stream API error response:', error)
        } catch (e) {
          // If response isn't JSON, try to get text
          try {
            const text = await response.text()
            errorMessage = text || errorMessage
            console.error('Stream API error text:', text)
          } catch (textError) {
            console.error('Stream API error - could not read response:', textError)
            errorMessage = `Server error (${response.status}): ${response.statusText}`
          }
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      const callId = data.callId || data.call?.id

      if (!callId) {
        throw new Error('Failed to get call ID from response')
      }

      // Navigate to stream page
      router.push(`/${community.slug}/events/${eventId}/stream`)
    } catch (error: any) {
      console.error('Error going live:', error)
      const errorMessage = error.message || 'Failed to go live. Please check your connection and try again.'
      toast.error(errorMessage)
    }
  }

  const handleJoinStream = (eventId: string) => {
    router.push(`/${community.slug}/events/${eventId}/stream`)
  }

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        {/* Navigation Tabs */}
        <CommunityNavigation 
          slug={community.slug} 
          isOwner={isOwner} 
          isMember={isMember}
          communityOwnerId={community.owner_id}
        />

        {isOwner && (
          <div className="flex justify-end">
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-white/10 text-white/80 hover:bg-white/20 w-full sm:w-auto flex-shrink-0 cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </div>
        )}

      {/* Live Events */}
      {liveEvents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
            <Play className="h-5 w-5 text-red-400" />
            Live Now
          </h2>
          <div className="grid gap-4">
            {liveEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                isOwner={isOwner && event.owner_id === currentUserId}
                isRegistered={userRegistrations.includes(event.id)}
                onRegister={() => handleRegisterForEvent(event.id)}
                onRegisterAndJoin={() => handleRegisterAndJoin(event.id)}
                onCancelRegistration={() => handleCancelRegistration(event.id)}
                onDelete={() => setDeleteDialogOpen(event.id)}
                onGoLive={() => handleGoLive(event.id)}
                onJoinStream={() => handleJoinStream(event.id)}
                streamJoinCost={streamJoinCost}
              />
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Events */}
      {scheduledEvents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming
          </h2>
          <div className="grid gap-4">
            {scheduledEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                isOwner={isOwner && event.owner_id === currentUserId}
                isRegistered={userRegistrations.includes(event.id)}
                onRegister={() => handleRegisterForEvent(event.id)}
                onCancelRegistration={() => handleCancelRegistration(event.id)}
                onDelete={() => setDeleteDialogOpen(event.id)}
                onGoLive={() => handleGoLive(event.id)}
                onJoinStream={() => handleJoinStream(event.id)}
                streamJoinCost={streamJoinCost}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed Events */}
      {completedEvents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Completed
          </h2>
          <div className="grid gap-4">
            {completedEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                isOwner={isOwner && event.owner_id === currentUserId}
                isRegistered={false}
                onJoinStream={() => handleJoinStream(event.id)}
                streamJoinCost={streamJoinCost}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {events.length === 0 && (
        <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
          <CardContent className="p-12 text-center">
            <Video className="h-16 w-16 text-white/40 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No Events Yet
            </h3>
            <p className="text-white/60 max-w-md mx-auto">
              {isOwner 
                ? "Create your first event to start hosting live streams!"
                : "This community doesn't have any events scheduled yet."}
            </p>
            {isOwner && (
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="mt-6 bg-white/10 text-white/80 hover:bg-white/20 cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Event Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open)
        if (!open) {
          // Reset form when closing
          setCreateStep(1)
          setEventDescription("")
          setEventDate(new Date())
          setEventTime(null)
        }
      }}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
            <DialogDescription>
              {createStep === 1 
                ? "Enter event details"
                : `Select date and time. You'll be charged ${streamStartCost} point(s) upfront.`}
            </DialogDescription>
          </DialogHeader>
          
          {createStep === 1 ? (
            <>
              <div className="py-4 w-full">
                <Textarea
                  id="description"
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  placeholder="What is this stream about? Keep it concise."
                  rows={8}
                  className="w-full resize-none min-h-[200px]"
                />
              </div>

              <DialogFooter>
                <Button
                  onClick={() => {
                    if (!eventDescription.trim()) {
                      toast.error("Please enter a description")
                      return
                    }
                    setCreateStep(2)
                  }}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Next: Choose Date & Time
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="py-4 w-full self-stretch">
                <CustomDateTimePicker
                  date={eventDate}
                  time={eventTime}
                  onDateChange={(newDate) => {
                    setEventDate(newDate)
                    setEventTime(null)
                  }}
                  onTimeChange={setEventTime}
                  disabledDates={(date) => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    return date < today
                  }}
                  timeSlots={timeSlots}
                />
              </div>

              <DialogFooter className="gap-3">
                <Button
                  onClick={() => setCreateStep(1)}
                  className="bg-white/10 text-white/80 hover:bg-white/20 border border-white/20"
                >
                  Back
                </Button>
                <Button
                  onClick={handleCreateEvent}
                  disabled={isCreating || !eventTime}
                  className="bg-white/10 text-white/80 hover:bg-white/20"
                >
                  {isCreating ? "Creating..." : userProfile?.role === 'admin' ? "Create Event (Free for admin)" : `Create Event (${streamStartCost} points)`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Event Dialog */}
      <Dialog open={!!deleteDialogOpen} onOpenChange={(open) => !open && !isDeleting && setDeleteDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this event? All registered users will be refunded, and you'll receive a refund for the creation cost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={confirmDeleteEvent}
              disabled={isDeleting}
            >
              {isDeleting ? "Cancelling..." : "Cancel Event & Refund All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}

// Event Card Component
interface EventCardProps {
  event: CommunityEvent & {
    registration_count?: number
    owner?: {
      id: string
      username: string
      first_name: string
      last_name: string
      profile_picture?: string
    }
  }
  isOwner: boolean
  isRegistered: boolean
  onRegister?: () => void
  onRegisterAndJoin?: () => void
  onCancelRegistration?: () => void
  onDelete?: () => void
  onGoLive?: () => void
  onJoinStream?: () => void
  streamJoinCost: number
}

function EventCard({ 
  event, 
  isOwner, 
  isRegistered,
  onRegister,
  onRegisterAndJoin,
  onCancelRegistration,
  onDelete,
  onGoLive,
  onJoinStream,
  streamJoinCost 
}: EventCardProps) {
  const registrationCount = event.registration_count || 0

  return (
    <Card className="group bg-white/10 backdrop-blur-md border-0 hover:bg-white/15 transition-colors">
      <CardContent className="p-3">
        {/* Event Header */}
        <div className="flex gap-4 mb-3">
          {/* Event Owner Avatar */}
          {event.owner && (
            <Link 
              href={`/profile/${event.owner.username}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0"
            >
              <Avatar className="h-10 w-10 border-4 border-white/20">
                <AvatarImage src={event.owner.profile_picture} alt={`${event.owner.first_name} ${event.owner.last_name}`} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm">
                  {event.owner.first_name[0]}{event.owner.last_name[0]}
                </AvatarFallback>
              </Avatar>
            </Link>
          )}

          {/* Event Info */}
          <div className="flex items-center gap-2 flex-1">
            <div className="flex flex-col">
              {event.owner && (
                <span className="text-white/80 text-sm font-medium">
                  {event.owner.first_name} {event.owner.last_name}
                </span>
              )}
              {getStatusBadge(event.status)}
            </div>
          </div>

          {/* Context Menu - Only show for event owner */}
          {isOwner && onDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center w-8 h-8 p-0 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30 flex-shrink-0"
                >
                  <MoreVertical className="h-4 w-4 text-white/70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onDelete} className="cursor-pointer text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Cancel Event
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        {/* Event Content */}
        <div className="mb-3">
          {/* Description only (title removed) */}
          {event.description && (
            <p className="text-white/80 text-base mb-2">{event.description}</p>
          )}
          
          {/* Scheduled Date */}
          <span className="text-white/40 text-sm">
            {formatDate(event.scheduled_at)}
          </span>
        </div>

        {/* Action Buttons and Registration Count */}
        <div className="flex items-center justify-between gap-4 mt-3">
              {isOwner && event.status === 'scheduled' && onGoLive && (
                <Button
                  size="sm"
                  onClick={onGoLive}
                  className="bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 hover:border-red-500/50 transition-all"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Go Live
                </Button>
              )}
              
              {isOwner && event.status === 'live' && onJoinStream && (
                <Button
                  size="sm"
                  onClick={onJoinStream}
                  className="bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 hover:border-red-500/50 transition-all"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Join Stream
                </Button>
              )}
              
              {!isOwner && event.status === 'live' && isRegistered && onJoinStream && (
                <Button
                  size="sm"
                  onClick={onJoinStream}
                  className="bg-white/10 text-white/80 border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Join Stream
                </Button>
              )}
              
              {!isOwner && !isRegistered && event.status === 'scheduled' && onRegister && (
                <Button
                  size="sm"
                  onClick={onRegister}
                  className="bg-white/10 text-white/80 border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all"
                >
                  Register ({streamJoinCost} points)
                </Button>
              )}
              
              {!isOwner && !isRegistered && event.status === 'live' && onRegisterAndJoin && (
                <Button
                  size="sm"
                  onClick={onRegisterAndJoin}
                  className="bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 hover:border-red-500/50 transition-all"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Register and Join ({streamJoinCost} points)
                </Button>
              )}
              
              {!isOwner && isRegistered && (event.status === 'scheduled' || event.status === 'live') && onCancelRegistration && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onCancelRegistration}
                  className="border-white/20 text-white/80 hover:bg-white/10 hover:border-white/30 transition-all"
                >
                  Cancel Registration
                </Button>
              )}
              
              {/* Registration Count - Container Style (like Boost button) */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30 ml-auto">
                <Users className="h-4 w-4 text-white/70" />
                <span className="text-white/70 text-xs font-medium">{registrationCount} registered</span>
              </div>
            </div>
      </CardContent>
    </Card>
  )
}

// Helper function for status badge (moved outside component to avoid re-render issues)
function getStatusBadge(status: EventStatus) {
  const variants: Record<EventStatus, { label: string; className: string }> = {
    scheduled: { label: 'Scheduled', className: 'bg-white/10 text-white/80 border-white/20' },
    live: { label: 'Live', className: 'bg-red-500/20 text-red-400 border-red-500/40' },
    completed: { label: 'Completed', className: 'bg-green-500/20 text-green-400 border-green-500/40' },
    cancelled: { label: 'Cancelled', className: 'bg-white/5 text-white/40 border-white/10' },
  }
  const variant = variants[status]
  return (
    <Badge className={cn(variant.className, "w-fit")}>
      {variant.label}
    </Badge>
  )
}

