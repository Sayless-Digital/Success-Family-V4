"use client"

import { useCallback, useRef } from "react"

export function useLongPress(isMobile: boolean, onLongPress: (messageId: string) => void) {
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const handleLongPressStart = useCallback((messageId: string, e: React.TouchEvent) => {
    if (!isMobile) return
    
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
    
    longPressTimer.current = setTimeout(() => {
      onLongPress(messageId)
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    }, 500)
  }, [isMobile, onLongPress])

  const handleLongPressMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current || !longPressTimer.current) return
    
    const deltaX = Math.abs(e.touches[0].clientX - touchStart.current.x)
    const deltaY = Math.abs(e.touches[0].clientY - touchStart.current.y)
    
    if (deltaX > 10 || deltaY > 10) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
      touchStart.current = null
    }
  }, [])

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    touchStart.current = null
  }, [])

  return {
    handleLongPressStart,
    handleLongPressMove,
    handleLongPressEnd,
  }
}

