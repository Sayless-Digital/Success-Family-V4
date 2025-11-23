"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"

// Cache for thread metadata (thread_id -> last_read_at)
type ThreadMetadata = {
  thread_id: string
  last_read_at: string | null
}

export function useUnreadMessagesCount(userId: string | null) {
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const threadMetadataRef = useRef<Map<string, ThreadMetadata>>(new Map())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0)
      setIsLoading(false)
      threadMetadataRef.current.clear()
      return
    }

    let isCancelled = false

    // Fetch initial count and cache thread metadata
    const fetchUnreadCount = async () => {
      try {
        const { data: participants, error: participantsError } = await supabase
          .from("dm_participants")
          .select("thread_id, last_read_at")
          .eq("user_id", userId)

        if (participantsError) {
          console.error("Error fetching participants:", participantsError)
          if (!isCancelled) {
            setUnreadCount(0)
            setIsLoading(false)
          }
          return
        }

        if (isCancelled) return

        if (!participants || participants.length === 0) {
          threadMetadataRef.current.clear()
          if (!isCancelled) {
            setUnreadCount(0)
            setIsLoading(false)
          }
          return
        }

        // Update thread metadata cache
        const threadMetadataMap = new Map<string, ThreadMetadata>()
        for (const participant of participants) {
          threadMetadataMap.set(participant.thread_id, {
            thread_id: participant.thread_id,
            last_read_at: participant.last_read_at,
          })
        }
        threadMetadataRef.current = threadMetadataMap

        // Count unread messages for all threads
        let totalUnread = 0

        for (const participant of participants) {
          const threadId = participant.thread_id
          const lastReadAt = participant.last_read_at

          let query = supabase
            .from("dm_messages")
            .select("id", { count: "exact", head: true })
            .eq("thread_id", threadId)
            .neq("sender_id", userId)

          if (lastReadAt) {
            query = query.gt("created_at", lastReadAt)
          }

          const { count, error: countError } = await query

          if (countError) {
            console.error(`Error counting messages for thread ${threadId}:`, countError)
            continue
          }

          totalUnread += count || 0
        }

        if (!isCancelled) {
          setUnreadCount(totalUnread)
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Error in fetchUnreadCount:", error)
        if (!isCancelled) {
          setUnreadCount(0)
          setIsLoading(false)
        }
      }
    }

    // Fetch initial count
    fetchUnreadCount()

    // Set up Realtime subscriptions
    // We can't subscribe to ALL dm_messages due to RLS/connection limits
    // Instead, we:
    // 1. Subscribe to dm_threads UPDATE (when last_message_at changes) without filters, check in handler
    // 2. Subscribe to dm_participants UPDATE/INSERT (when last_read_at changes or new participant added)
    // 3. Use periodic polling as fallback (every 10 seconds) for new messages
    try {
      // Periodic polling as fallback to detect new messages
      pollIntervalRef.current = setInterval(() => {
        if (isCancelled) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
          return
        }
        // Only poll if tab is visible (to save resources)
        if (document.visibilityState === 'visible') {
          fetchUnreadCount()
        }
      }, 10000) // Poll every 10 seconds as fallback

      const channel = supabase
        .channel(`unread-messages-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "dm_threads",
            // No filter - check in handler if user is participant
          },
          async (payload) => {
            if (isCancelled) return
            
            try {
              const updated = payload.new as any
              if (!updated || !updated.id) {
                return
              }

              // Check if user is a participant in this thread
              const threadMetadata = threadMetadataRef.current.get(updated.id)
              
              // If we have metadata for this thread, user is a participant
              if (threadMetadata) {
                // Check if last_message_at changed (indicates new message)
                const oldLastMessageAt = payload.old?.last_message_at
                const newLastMessageAt = updated.last_message_at
                
                if (oldLastMessageAt !== newLastMessageAt && newLastMessageAt) {
                  fetchUnreadCount()
                }
              }
            } catch (error) {
              console.error("[useUnreadMessagesCount] Error processing thread UPDATE:", error)
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "dm_participants",
            // Remove filter - handle filtering in handler to ensure we catch all updates
          },
          async (payload) => {
            if (isCancelled) return

            try {
              const updated = payload.new as any
              if (!updated || !updated.thread_id || !updated.user_id) {
                console.warn("[useUnreadMessagesCount] Invalid participant UPDATE payload:", payload)
                return
              }

              // Filter by user_id in handler instead of subscription filter
              if (updated.user_id !== userId) {
                return
              }

              // Update thread metadata cache
              const oldMetadata = threadMetadataRef.current.get(updated.thread_id)
              const newLastReadAt = updated.last_read_at

              threadMetadataRef.current.set(updated.thread_id, {
                thread_id: updated.thread_id,
                last_read_at: newLastReadAt,
              })

              // If last_read_at was updated, we need to recalculate the count
              // because messages that were unread might now be read
              if (oldMetadata?.last_read_at !== newLastReadAt) {
                // Refetch to get accurate count
                fetchUnreadCount()
              }
            } catch (error) {
              console.error("[useUnreadMessagesCount] Error processing participant UPDATE:", error)
              fetchUnreadCount()
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "dm_participants",
          },
          async (payload) => {
            if (isCancelled) return

            try {
              const newParticipant = payload.new as any
              if (!newParticipant || !newParticipant.user_id) {
                return
              }

              // Filter by user_id in handler
              if (newParticipant.user_id !== userId) {
                return
              }

              // User joined a new thread, refetch to include it
              fetchUnreadCount()
            } catch (error) {
              console.error("[useUnreadMessagesCount] Error processing participant INSERT:", error)
              fetchUnreadCount()
            }
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            // Channel subscription failed - this is non-critical
            // The polling fallback will continue to work
            // Only log in development to avoid console noise in production
            if (process.env.NODE_ENV === 'development') {
              console.warn("[useUnreadMessagesCount] Channel subscription error - using polling fallback")
            }
            // Don't throw or set error state - polling will handle updates
          }
        })

      channelRef.current = channel
    } catch (error) {
      console.error("[useUnreadMessagesCount] Error setting up channel:", error)
      if (!isCancelled) {
        fetchUnreadCount()
      }
    }

    return () => {
      isCancelled = true
      threadMetadataRef.current.clear()

      // Clear polling interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }

      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current)
        } catch (error) {
          console.error("[useUnreadMessagesCount] Error removing channel:", error)
        } finally {
          channelRef.current = null
        }
      }
    }
  }, [userId])

  return { unreadCount, isLoading }
}

