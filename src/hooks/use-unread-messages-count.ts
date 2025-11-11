"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"

export function useUnreadMessagesCount(userId: string | null) {
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0)
      setIsLoading(false)
      return
    }

    let channel: RealtimeChannel | null = null
    let isCancelled = false

    const fetchUnreadCount = async () => {
      try {
        // Get all threads where the user is a participant with their last_read_at
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

        if (isCancelled || !participants || participants.length === 0) {
          if (!isCancelled) {
            setUnreadCount(0)
            setIsLoading(false)
          }
          return
        }

        // Count unread messages across all threads
        // A message is unread if:
        // 1. It was sent by someone else (not the current user)
        // 2. It was created after the user's last_read_at for that thread (or last_read_at is null)
        let totalUnread = 0

        // Process each thread to count unread messages
        for (const participant of participants) {
          const threadId = participant.thread_id
          const lastReadAt = participant.last_read_at

          // Build query to count unread messages in this thread
          let query = supabase
            .from("dm_messages")
            .select("id", { count: "exact", head: true })
            .eq("thread_id", threadId)
            .neq("sender_id", userId) // Only messages from others

          // If there's a last_read_at, only count messages after that time
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

    // Debounced refetch to avoid too many requests (reduced from 300ms to 100ms for faster updates)
    const debouncedRefetch = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(() => {
        if (!isCancelled) {
          fetchUnreadCount()
        }
      }, 100) // 100ms debounce for faster updates
    }

    // Immediate refetch (no debounce) for critical updates
    const immediateRefetch = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      if (!isCancelled) {
        fetchUnreadCount()
      }
    }

    // Initial fetch
    fetchUnreadCount()

    // Subscribe to real-time updates using Supabase Realtime
    // Listen to new messages and participant updates
    channel = supabase
      .channel(`unread-messages-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_messages",
        },
        async (payload) => {
          if (isCancelled) return
          
          // When a new message is inserted, check if it's relevant to the current user
          const newMessage = payload.new as any
          if (!newMessage || newMessage.sender_id === userId) {
            return // Skip if it's our own message
          }

          // Check if the current user is a participant in this thread
          const { data: participant } = await supabase
            .from("dm_participants")
            .select("thread_id")
            .eq("thread_id", newMessage.thread_id)
            .eq("user_id", userId)
            .maybeSingle()

          // Only refetch if user is a participant in this thread
          // Use immediate refetch for new messages (critical update)
          if (participant) {
            immediateRefetch()
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
        () => {
          // When last_read_at is updated (messages marked as read), refetch count immediately
          if (!isCancelled) {
            immediateRefetch()
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && !isCancelled) {
          // Refetch after subscription is established to ensure we have the latest count
          fetchUnreadCount()
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`[useUnreadMessagesCount] Channel error: ${status}`)
          // Try to refetch on error to get current state
          if (!isCancelled) {
            fetchUnreadCount()
          }
        }
      })

    return () => {
      isCancelled = true
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [userId])

  return { unreadCount, isLoading }
}
