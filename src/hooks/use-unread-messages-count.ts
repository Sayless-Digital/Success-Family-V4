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
    let channelSubscribed = false

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

        if (isCancelled || !participants || participants.length === 0) {
          if (!isCancelled) {
            setUnreadCount(0)
            setIsLoading(false)
          }
          return
        }

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

    const debouncedRefetch = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(() => {
        if (!isCancelled) {
          fetchUnreadCount()
        }
      }, 100)
    }

    const immediateRefetch = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      if (!isCancelled) {
        fetchUnreadCount()
      }
    }

    fetchUnreadCount()

    const subscriptionTimer = setTimeout(() => {
      if (isCancelled) return
      
      try {
        channel = supabase
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
            async (payload) => {
              if (isCancelled || !channelSubscribed) return
              
              const newMessage = payload.new as any
              if (!newMessage || newMessage.sender_id === userId) {
                return
              }

              const { data: participant } = await supabase
                .from("dm_participants")
                .select("thread_id")
                .eq("thread_id", newMessage.thread_id)
                .eq("user_id", userId)
                .maybeSingle()

              if (participant && !isCancelled) {
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
              if (!isCancelled && channelSubscribed) {
                immediateRefetch()
              }
            },
          )
          .subscribe((status) => {
            if (isCancelled) return
            
            if (status === "SUBSCRIBED") {
              channelSubscribed = true
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
      } catch (error) {
        console.error("[useUnreadMessagesCount] Error setting up channel:", error)
        if (!isCancelled) {
          fetchUnreadCount()
        }
      }
    }, 500)

    return () => {
      isCancelled = true
      channelSubscribed = false
      clearTimeout(subscriptionTimer)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (channel) {
        try {
          supabase.removeChannel(channel)
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  }, [userId])

  return { unreadCount, isLoading }
}
