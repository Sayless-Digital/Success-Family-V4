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

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0)
      setIsLoading(false)
      threadMetadataRef.current.clear()
      return
    }

    let isCancelled = false
    let channelSubscribed = false

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
          console.log("[useUnreadMessagesCount] Setting unread count:", totalUnread)
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

    // Set up Realtime subscription immediately (no delay)
    // Use a simpler channel config - no presence needed since we're only listening to postgres_changes
    try {
      const channel = supabase
        .channel(`unread-messages-${userId}`, {
          config: {
            broadcast: { self: false },
          },
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "dm_messages",
          },
          async (payload) => {
            if (isCancelled || !channelSubscribed) return

            try {
              const newMessage = payload.new as any
              if (!newMessage || !newMessage.thread_id || !newMessage.sender_id) {
                console.warn("[useUnreadMessagesCount] Invalid message payload:", payload)
                return
              }

              // Ignore messages from the current user
              if (newMessage.sender_id === userId) return

              // Check if this message is in a thread where the user is a participant
              const threadMetadata = threadMetadataRef.current.get(newMessage.thread_id)
              if (!threadMetadata) {
                // User might have just joined the thread, refetch to be safe
                console.log("[useUnreadMessagesCount] Thread metadata not found, refetching count")
                fetchUnreadCount()
                return
              }

              // Check if message is unread (created after last_read_at)
              const messageCreatedAt = new Date(newMessage.created_at)
              const lastReadAt = threadMetadata.last_read_at
                ? new Date(threadMetadata.last_read_at)
                : null

              // If no last_read_at or message is newer, increment count immediately
              if (!lastReadAt || messageCreatedAt > lastReadAt) {
                console.log("[useUnreadMessagesCount] Incrementing unread count for new message:", newMessage.id)
                setUnreadCount((prev) => {
                  const newCount = Math.max(0, prev + 1)
                  console.log("[useUnreadMessagesCount] Unread count update:", prev, "->", newCount, "for userId:", userId)
                  return newCount
                })
              } else {
                console.log("[useUnreadMessagesCount] Message is already read, skipping increment")
              }
            } catch (error) {
              console.error("[useUnreadMessagesCount] Error processing message INSERT:", error)
              // Refetch on error to ensure accuracy
              fetchUnreadCount()
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
            if (isCancelled || !channelSubscribed) return

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

              console.log("[useUnreadMessagesCount] Participant UPDATE received:", {
                thread_id: updated.thread_id,
                user_id: updated.user_id,
                old_last_read_at: payload.old?.last_read_at,
                new_last_read_at: updated.last_read_at,
              })

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
                console.log("[useUnreadMessagesCount] last_read_at changed, refetching count")
                // Refetch to get accurate count
                fetchUnreadCount()
              }
            } catch (error) {
              console.error("[useUnreadMessagesCount] Error processing participant UPDATE:", error)
              // Refetch on error to ensure accuracy
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
            // Remove filter - handle filtering in handler
          },
          async (payload) => {
            if (isCancelled || !channelSubscribed) return

            try {
              const newParticipant = payload.new as any
              if (!newParticipant || !newParticipant.user_id) {
                return
              }

              // Filter by user_id in handler
              if (newParticipant.user_id !== userId) {
                return
              }

              console.log("[useUnreadMessagesCount] New participant INSERT, refetching count")
              // User joined a new thread, refetch to include it
              fetchUnreadCount()
            } catch (error) {
              console.error("[useUnreadMessagesCount] Error processing participant INSERT:", error)
              fetchUnreadCount()
            }
          },
        )
        .subscribe(async (status, err) => {
          if (isCancelled) return

          if (err) {
            console.error(`[useUnreadMessagesCount] Subscription error:`, err)
            channelSubscribed = false
            // Retry subscription after a delay
            if (!isCancelled) {
              setTimeout(() => {
                if (!isCancelled && channelRef.current) {
                  console.log("[useUnreadMessagesCount] Retrying subscription after error...")
                  channelRef.current.subscribe()
                }
              }, 3000)
            }
            // Still refetch to get current count
            fetchUnreadCount()
            return
          }

          if (status === "SUBSCRIBED") {
            channelSubscribed = true
            console.log("[useUnreadMessagesCount] Successfully subscribed to realtime")
            // Refetch to ensure count is accurate after subscription is active
            fetchUnreadCount()
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error(`[useUnreadMessagesCount] Channel error: ${status}, attempting to resubscribe...`)
            channelSubscribed = false
            
            // Retry subscription after a delay
            if (!isCancelled) {
              setTimeout(() => {
                if (!isCancelled && channelRef.current) {
                  console.log("[useUnreadMessagesCount] Retrying subscription after channel error...")
                  channelRef.current.subscribe()
                }
              }, 3000)
            }
            
            // Still refetch to get current count
            if (!isCancelled) {
              fetchUnreadCount()
            }
          } else if (status === "CLOSED") {
            channelSubscribed = false
            console.log("[useUnreadMessagesCount] Channel closed")
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
      channelSubscribed = false
      threadMetadataRef.current.clear()

      if (channelRef.current) {
        try {
          console.log("[useUnreadMessagesCount] Cleaning up channel for userId:", userId)
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









