"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"

export function useUnreadMessagesPerThread(userId: string | null, threadIds: string[]) {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!userId || threadIds.length === 0) {
      setUnreadCounts({})
      setIsLoading(false)
      return
    }

    let channel: RealtimeChannel | null = null
    let isCancelled = false

    const fetchUnreadCounts = async () => {
      try {
        // Get participants for all threads
        const { data: participants, error: participantsError } = await supabase
          .from("dm_participants")
          .select("thread_id, last_read_at")
          .eq("user_id", userId)
          .in("thread_id", threadIds)

        if (participantsError) {
          console.error("Error fetching participants:", participantsError)
          if (!isCancelled) {
            setUnreadCounts({})
            setIsLoading(false)
          }
          return
        }

        if (isCancelled) {
          return
        }

        // Build a map of thread_id -> last_read_at
        const lastReadMap = new Map<string, string | null>()
        participants?.forEach((p) => {
          lastReadMap.set(p.thread_id, p.last_read_at)
        })

        // Count unread messages for each thread
        const counts: Record<string, number> = {}

        for (const threadId of threadIds) {
          const lastReadAt = lastReadMap.get(threadId)

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
            counts[threadId] = 0
            continue
          }

          counts[threadId] = count || 0
        }

        if (!isCancelled) {
          setUnreadCounts(counts)
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Error in fetchUnreadCounts:", error)
        if (!isCancelled) {
          setUnreadCounts({})
          setIsLoading(false)
        }
      }
    }

    // Debounced refetch
    const debouncedRefetch = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(() => {
        if (!isCancelled) {
          fetchUnreadCounts()
        }
      }, 100)
    }

    // Immediate refetch for critical updates
    const immediateRefetch = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      if (!isCancelled) {
        fetchUnreadCounts()
      }
    }

    // Initial fetch
    fetchUnreadCounts()

    // Subscribe to real-time updates
    channel = supabase
      .channel(`unread-per-thread-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_messages",
        },
        async (payload) => {
          if (isCancelled) return

          const newMessage = payload.new as any
          if (!newMessage || newMessage.sender_id === userId) {
            return
          }

          // Only refetch if this message is in one of our tracked threads
          if (threadIds.includes(newMessage.thread_id)) {
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
          if (!isCancelled) {
            immediateRefetch()
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && !isCancelled) {
          fetchUnreadCounts()
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
  }, [userId, threadIds.join(",")])

  return { unreadCounts, isLoading }
}
















