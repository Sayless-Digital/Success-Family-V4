"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { DM_TYPING_EVENT } from "@/lib/chat-shared"

const TYPING_EXPIRATION_MS = 4000
const TYPING_DEBOUNCE_MS = 1200

export function useTypingIndicators(
  channelRef: React.MutableRefObject<RealtimeChannel | null>,
  viewerId: string,
  selectedThreadId: string | null
) {
  const [typingIndicators, setTypingIndicators] = useState<Record<string, { userId: string; expiresAt: number }>>({})
  const [displayTypingIndicators, setDisplayTypingIndicators] = useState<Record<string, boolean>>({})
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const typingBroadcastCooldownRef = useRef<NodeJS.Timeout | null>(null)
  const typingDisplayTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({})

  const notifyTyping = useCallback(
    (typing: boolean) => {
      if (!channelRef.current) return
      channelRef.current.send({
        type: "broadcast",
        event: DM_TYPING_EVENT,
        payload: {
          userId: viewerId,
          typing,
        },
      })
    },
    [channelRef, viewerId],
  )

  const scheduleTypingBroadcast = useCallback(() => {
    if (typingBroadcastCooldownRef.current) return
    notifyTyping(true)
    typingBroadcastCooldownRef.current = setTimeout(() => {
      typingBroadcastCooldownRef.current = null
      notifyTyping(false)
    }, TYPING_EXPIRATION_MS)
  }, [notifyTyping])

  // Handle typing indicator expiration
  useEffect(() => {
    if (!selectedThreadId) return
    if (!typingIndicators[selectedThreadId]) return

    const timeout = setTimeout(() => {
      setTypingIndicators((prev) => {
        const current = prev[selectedThreadId]
        if (!current) return prev
        if (Date.now() < current.expiresAt) return prev
        const next = { ...prev }
        delete next[selectedThreadId]
        return next
      })
    }, TYPING_EXPIRATION_MS)

    return () => clearTimeout(timeout)
  }, [selectedThreadId, typingIndicators])

  // Add grace period for typing indicator display
  useEffect(() => {
    if (!selectedThreadId) return

    const isTyping = !!typingIndicators[selectedThreadId]

    if (isTyping) {
      setDisplayTypingIndicators((prev) => ({
        ...prev,
        [selectedThreadId]: true,
      }))
      
      if (typingDisplayTimeoutRef.current[selectedThreadId]) {
        clearTimeout(typingDisplayTimeoutRef.current[selectedThreadId])
        delete typingDisplayTimeoutRef.current[selectedThreadId]
      }
    } else {
      setDisplayTypingIndicators((prev) => {
        const isCurrentlyDisplayed = prev[selectedThreadId]
        if (isCurrentlyDisplayed) {
          if (typingDisplayTimeoutRef.current[selectedThreadId]) {
            clearTimeout(typingDisplayTimeoutRef.current[selectedThreadId])
          }
          const timeout = setTimeout(() => {
            setDisplayTypingIndicators((current) => {
              const next = { ...current }
              delete next[selectedThreadId]
              return next
            })
            delete typingDisplayTimeoutRef.current[selectedThreadId]
          }, 2000)
          
          typingDisplayTimeoutRef.current[selectedThreadId] = timeout
        }
        return prev
      })
    }

    return () => {
      if (typingDisplayTimeoutRef.current[selectedThreadId]) {
        clearTimeout(typingDisplayTimeoutRef.current[selectedThreadId])
        delete typingDisplayTimeoutRef.current[selectedThreadId]
      }
    }
  }, [selectedThreadId, typingIndicators])

  return {
    typingIndicators,
    setTypingIndicators,
    displayTypingIndicators,
    setDisplayTypingIndicators,
    notifyTyping,
    scheduleTypingBroadcast,
    typingDisplayTimeoutRef,
  }
}

