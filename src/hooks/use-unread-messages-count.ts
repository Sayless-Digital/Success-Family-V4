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
    try {
      const channel = supabase
        .channel(`unread-messages-${userId}`, {
          config: {
            broadcast: { self: false },
            presence: { key: userId },
          },
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "dm_messages",
          },
          (payload) => {
            if (isCancelled || !channelSubscribed) return

            const newMessage = payload.new as any
            if (!newMessage) return

            // Ignore messages from the current user
            if (newMessage.sender_id === userId) return

            // Check if this message is in a thread where the user is a participant
            const threadMetadata = threadMetadataRef.current.get(newMessage.thread_id)
            if (!threadMetadata) {
              // User might have just joined the thread, refetch to be safe
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
              setUnreadCount((prev) => prev + 1)
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "dm_participants",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (isCancelled || !channelSubscribed) return

            const updated = payload.new as any
            if (!updated) return

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
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "dm_participants",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            // User joined a new thread, refetch to include it
            if (!isCancelled && channelSubscribed) {
              fetchUnreadCount()
            }
          },
        )
        .subscribe((status) => {
          if (isCancelled) return

          if (status === "SUBSCRIBED") {
            channelSubscribed = true
            // Refetch to ensure count is accurate after subscription is active
            fetchUnreadCount()
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error(`[useUnreadMessagesCount] Channel error: ${status}`)
            channelSubscribed = false
            if (!isCancelled) {
              fetchUnreadCount()
            }
          } else if (status === "CLOSED") {
            channelSubscribed = false
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
          supabase.removeChannel(channelRef.current)
        } catch (error) {
          // Ignore cleanup errors
        }
        channelRef.current = null
      }
    }
  }, [userId])

  return { unreadCount, isLoading }
}



