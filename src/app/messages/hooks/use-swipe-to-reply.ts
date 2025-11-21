"use client"

import { useCallback, useRef, useState } from "react"

export function useSwipeToReply(isMobile: boolean, longPressMenuOpen: string | null) {
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({})
  const [swipingMessageId, setSwipingMessageId] = useState<string | null>(null)
  const swipeTouchStart = useRef<{ x: number; y: number; messageId: string } | null>(null)

  const handleSwipeStart = useCallback((messageId: string, e: React.TouchEvent) => {
    if (!isMobile) return
    if (longPressMenuOpen) return
    
    swipeTouchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      messageId
    }
    setSwipingMessageId(messageId)
  }, [isMobile, longPressMenuOpen])

  const handleSwipeMove = useCallback((e: React.TouchEvent) => {
    if (!swipeTouchStart.current || !isMobile) return
    
    const currentX = e.touches[0].clientX
    const currentY = e.touches[0].clientY
    const messageId = swipeTouchStart.current.messageId
    const deltaX = currentX - swipeTouchStart.current.x
    const deltaY = Math.abs(currentY - swipeTouchStart.current.y)
    
    if (deltaY > 30) {
      const cancelledMessageId = messageId
      swipeTouchStart.current = null
      setSwipingMessageId(null)
      setSwipeOffset(prev => {
        const next = { ...prev }
        delete next[cancelledMessageId]
        return next
      })
      return
    }
    
    if (deltaX > 0) {
      const offset = Math.min(deltaX, 120)
      setSwipeOffset(prev => ({
        ...prev,
        [messageId]: offset
      }))
    } else if (deltaX < 0 && swipeOffset[messageId]) {
      const offset = Math.max(deltaX, 0)
      setSwipeOffset(prev => ({
        ...prev,
        [messageId]: offset
      }))
    }
  }, [isMobile, swipeOffset])

  const handleSwipeEnd = useCallback((messageId: string, onReply: (messageId: string) => void) => {
    if (!swipeTouchStart.current || swipeTouchStart.current.messageId !== messageId) {
      setSwipingMessageId(null)
      setSwipeOffset(prev => {
        const next = { ...prev }
        delete next[messageId]
        return next
      })
      return
    }
    
    const offset = swipeOffset[messageId] || 0
    
    if (offset > 60) {
      onReply(messageId)
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    }
    
    swipeTouchStart.current = null
    setSwipingMessageId(null)
    setSwipeOffset(prev => {
      const next = { ...prev }
      delete next[messageId]
      return next
    })
  }, [swipeOffset])

  return {
    swipeOffset,
    swipingMessageId,
    handleSwipeStart,
    handleSwipeMove,
    handleSwipeEnd,
  }
}


