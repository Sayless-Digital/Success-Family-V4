"use client"

import React from "react"
import { ParticipantView, useCallStateHooks } from "@stream-io/video-react-sdk"
import { cn } from "@/lib/utils"

interface DraggableSelfViewProps {
  visible: boolean
  isCameraEnabled: boolean
  userName: string
  userImage?: string | null
}

/**
 * Draggable self-view component - landscape on desktop, portrait on mobile
 * Allows users to drag their video preview to any corner of the screen
 */
export function DraggableSelfView({
  visible,
  isCameraEnabled,
  userName,
  userImage
}: DraggableSelfViewProps) {
  // Constants for boundaries
  const PADDING = 16
  const HEADER_HEIGHT = 48
  const BOTTOM_BAR_HEIGHT = 48
  
  // Responsive dimensions: landscape on desktop, portrait on mobile
  const [isDesktop, setIsDesktop] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : false
  )
  
  const VIDEO_WIDTH = isDesktop ? 240 : 100
  const VIDEO_HEIGHT = isDesktop ? 135 : 180
  
  // React state for position and drag state
  const [position, setPosition] = React.useState(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 }
    const width = window.innerWidth >= 768 ? 240 : 100
    const height = window.innerWidth >= 768 ? 135 : 180
    return {
      x: window.innerWidth - width - PADDING,
      y: window.innerHeight - height - BOTTOM_BAR_HEIGHT - PADDING
    }
  })
  
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 })
  const [opacity, setOpacity] = React.useState(1)
  const [cursor, setCursor] = React.useState<'grab' | 'grabbing'>('grab')
  const [transition, setTransition] = React.useState<string>('none')
  
  const elementRef = React.useRef<HTMLDivElement>(null)
  const animationFrameRef = React.useRef<number | null>(null)
  const pointerIdRef = React.useRef<number | null>(null)
  const positionRef = React.useRef(position)
  
  // Sync positionRef when position changes externally
  React.useEffect(() => {
    positionRef.current = position
  }, [position])
  
  const { useLocalParticipant } = useCallStateHooks()
  const localParticipant = useLocalParticipant()

  // Update desktop state on resize
  React.useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768)
    }
    
    window.addEventListener('resize', checkDesktop)
    checkDesktop()
    
    return () => window.removeEventListener('resize', checkDesktop)
  }, [])

  // Update position when desktop state changes
  React.useEffect(() => {
    const currentWidth = isDesktop ? 240 : 100
    const currentHeight = isDesktop ? 135 : 180
    const bounds = {
      minX: PADDING,
      minY: HEADER_HEIGHT + PADDING,
      maxX: window.innerWidth - currentWidth - PADDING,
      maxY: window.innerHeight - currentHeight - BOTTOM_BAR_HEIGHT - PADDING
    }
    
    setPosition(prev => ({
      x: Math.min(prev.x, bounds.maxX),
      y: Math.max(bounds.minY, Math.min(prev.y, bounds.maxY))
    }))
  }, [isDesktop])

  // Helper to get bounds
  const getBounds = React.useCallback(() => {
    const currentWidth = isDesktop ? 240 : 100
    const currentHeight = isDesktop ? 135 : 180
    return {
      minX: PADDING,
      minY: HEADER_HEIGHT + PADDING,
      maxX: window.innerWidth - currentWidth - PADDING,
      maxY: window.innerHeight - currentHeight - BOTTOM_BAR_HEIGHT - PADDING
    }
  }, [isDesktop])

  // Snap to corner function
  const snapToCorner = React.useCallback(() => {
    const bounds = getBounds()
    const currentWidth = isDesktop ? 240 : 100
    const currentHeight = isDesktop ? 135 : 180
    const centerX = window.innerWidth / 2
    const centerY = (window.innerHeight - HEADER_HEIGHT - BOTTOM_BAR_HEIGHT) / 2 + HEADER_HEIGHT
    
    // Calculate target position
    const isLeft = positionRef.current.x + currentWidth / 2 < centerX
    const isTop = positionRef.current.y + currentHeight / 2 < centerY
    const targetX = isLeft ? bounds.minX : bounds.maxX
    const targetY = isTop ? bounds.minY : bounds.maxY
    
    // Enable transition FIRST
    setTransition('transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)')
    
    // Update position in next frame so browser can animate
    requestAnimationFrame(() => {
      if (elementRef.current) {
        // Update ref for immediate DOM update
        positionRef.current = { x: targetX, y: targetY }
        // Update DOM directly with transition
        elementRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`
        // Sync state for React
        setPosition({ x: targetX, y: targetY })
      }
      
      // Clear transition after animation
      setTimeout(() => setTransition('none'), 300)
    })
  }, [isDesktop, getBounds])

  // Update position during drag - DIRECT DOM UPDATE (no React state, no RAF delay)
  const updatePosition = React.useCallback((clientX: number, clientY: number) => {
    if (!elementRef.current) return
    
    const bounds = getBounds()
    let x = clientX - dragOffset.x
    let y = clientY - dragOffset.y
    
    x = Math.max(bounds.minX, Math.min(x, bounds.maxX))
    y = Math.max(bounds.minY, Math.min(y, bounds.maxY))
    
    // Update DOM directly - zero latency, no React re-render
    elementRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
    
    // Store in ref for state sync later
    positionRef.current = { x, y }
  }, [dragOffset, getBounds])

  // Pointer event handlers
  const handlePointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    pointerIdRef.current = e.pointerId
    
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    
    e.currentTarget.setPointerCapture(e.pointerId)
    setCursor('grabbing')
    setTransition('none')
    setOpacity(0.9)
  }, [])

  const handlePointerMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    e.preventDefault()
    e.stopPropagation()
    
    // DIRECT update - no RAF delay, immediate response
    updatePosition(e.clientX, e.clientY)
  }, [isDragging, updatePosition])

  const handlePointerUp = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    
    setIsDragging(false)
    
    if (pointerIdRef.current !== null && e.currentTarget.hasPointerCapture(pointerIdRef.current)) {
      e.currentTarget.releasePointerCapture(pointerIdRef.current)
      pointerIdRef.current = null
    }
    
    // Sync React state with final position
    setPosition(positionRef.current)
    
    setCursor('grab')
    setOpacity(1)
    snapToCorner()
  }, [isDragging, snapToCorner])

  // Touch event handlers (fallback)
  const handleTouchStart = React.useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (isDragging) return
    e.preventDefault()
    e.stopPropagation()
    
    const touch = e.touches[0]
    setIsDragging(true)
    
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    })
    
    setTransition('none')
    setOpacity(0.9)
  }, [isDragging])

  const handleTouchMove = React.useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return
    e.preventDefault()
    e.stopPropagation()
    
    const touch = e.touches[0]
    
    // DIRECT update - no RAF delay, immediate response
    updatePosition(touch.clientX, touch.clientY)
  }, [isDragging, updatePosition])

  const handleTouchEnd = React.useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return
    e.preventDefault()
    
    setIsDragging(false)
    
    // Sync React state with final position
    setPosition(positionRef.current)
    
    setOpacity(1)
    snapToCorner()
  }, [isDragging, snapToCorner])

  // Handle window resize
  React.useEffect(() => {
    const handleResize = () => {
      const bounds = getBounds()
      setPosition(prev => ({
        x: Math.min(prev.x, bounds.maxX),
        y: Math.max(bounds.minY, Math.min(prev.y, bounds.maxY))
      }))
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [getBounds])

  // Cleanup animation frame on unmount
  React.useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  if (!localParticipant || !visible) return null

  return (
    <div
      ref={elementRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 30,
        // Use position from ref during drag, state only for initial render
        transform: `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0)`,
        transition,
        willChange: 'transform',
        cursor,
        opacity,
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      className={cn(
        "rounded-xl overflow-hidden shadow-2xl border-2 border-white/10 bg-black/20",
        isDesktop ? "w-[240px] h-[135px]" : "w-[100px] h-[180px]"
      )}
    >
      <div className="relative w-full h-full pointer-events-none">
        {/* Use GetStream's ParticipantView for reliable video rendering with custom styles */}
        <div className="absolute inset-0 w-full h-full stream-participant-wrapper stream-preview-small">
          <ParticipantView
            participant={localParticipant}
            className="w-full h-full"
            trackType="videoTrack"
          />
        </div>
        
        {/* Name overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
          <div className="absolute bottom-1.5 left-2 inline-block bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
            <span className="text-white text-xs font-medium whitespace-nowrap">
              {userName}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}