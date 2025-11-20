"use client"

import { useMemo, useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useIsChristmasMode } from "@/components/holiday-mode-context"

/**
 * Snow buildup effect for the bottom of cards
 * Creates a decorative snow accumulation effect with a snowman
 * Cycles through many variations like an animation
 */
export function SnowBuildup({ className, cardId }: { className?: string; cardId?: string }) {
  const isChristmasSeason = useIsChristmasMode()
  const [animationFrame, setAnimationFrame] = useState(0)
  const [isWaving, setIsWaving] = useState(false)

  // Generate a starting variation based on cardId or random seed
  const baseVariation = useMemo(() => {
    if (cardId) {
      // Use cardId to generate consistent starting variation
      let hash = 0
      for (let i = 0; i < cardId.length; i++) {
        hash = ((hash << 5) - hash) + cardId.charCodeAt(i)
        hash = hash & hash
      }
      return Math.abs(hash) % 100
    }
    // Random variation if no cardId
    return Math.floor(Math.random() * 100)
  }, [cardId])

  // Generate snowman position based on cardId - many variations on right half
  // Position is stable per cardId, so each post has a consistent position
  const snowmanPositionIndex = useMemo(() => {
    if (!cardId) return Math.floor(Math.random() * 25)
    
    // Generate position hash from cardId - this ensures each cardId gets a unique, stable position
    let hash = 0
    for (let i = 0; i < cardId.length; i++) {
      hash = ((hash << 5) - hash) + cardId.charCodeAt(i)
      hash = hash & hash
    }
    return Math.abs(hash) % 25
  }, [cardId])

  // Generate ground type based on cardId - locked to each post
  // Different ground types have different wave patterns, heights, and characteristics
  const groundTypeIndex = useMemo(() => {
    if (!cardId) return Math.floor(Math.random() * 20)
    
    // Generate ground type hash from cardId - different from snowman position
    let hash = 0
    for (let i = 0; i < cardId.length; i++) {
      hash = ((hash << 7) - hash) + cardId.charCodeAt(i) * (i + 1)
      hash = hash & hash
    }
    return Math.abs(hash) % 20
  }, [cardId])

  // Cycle through variations (30 different variations)
  useEffect(() => {
    if (!isChristmasSeason) return
    
    const interval = setInterval(() => {
      setAnimationFrame((prev) => (prev + 1) % 30)
    }, 8000) // Change variation every 8 seconds

    return () => clearInterval(interval)
  }, [isChristmasSeason])

  // Make snowman wave every once in a while
  useEffect(() => {
    if (!isChristmasSeason) return

    const waveInterval = setInterval(() => {
      setIsWaving(true)
      // Wave animation lasts 1.5 seconds
      setTimeout(() => {
        setIsWaving(false)
      }, 1500)
    }, 12000) // Wave every 12 seconds

    return () => clearInterval(waveInterval)
  }, [isChristmasSeason])

  if (!isChristmasSeason) return null

  // Combine base variation with animation frame for snowflake animations only
  const variation = (baseVariation + animationFrame * 7) % 100

  // Ground type parameters - locked to cardId, stable per post
  // 20 different ground types with subtle, terrain-like characteristics
  const groundTypeBaseHeight = 16 + ((groundTypeIndex % 8) * 1.2) // 16 to 25.6 in 8 steps
  const groundTypeWaveIntensity = 0.5 + ((groundTypeIndex % 5) * 0.2) // 0.5 to 1.3 - moderate choppiness
  const groundTypeWaveFrequency = 1.2 + ((groundTypeIndex % 6) * 0.4) // 1.2 to 3.2 - more variation
  const groundTypeHeightVariation = ((groundTypeIndex % 4) * 0.25) + 0.15 // 0.15 to 0.9 - more texture
  const groundTypeOffset = (groundTypeIndex * 0.5) % (Math.PI * 2) // Phase offset for waves

  // Animation-only variations (for snowflakes)
  const snowflakeCount = 4 + (variation % 6) // 4-9 snowflakes
  
  // 25 different positions on the right half (from 50% to 100% of width)
  const snowmanPositionPercent = 50 + (snowmanPositionIndex * 2) // 50% to 98% in 2% increments
  const snowmanSize = 0.9 // Fixed size

  // Generate natural snow buildup path with smooth curves
  // Ground type is completely static and locked to cardId - no animation
  const generateSnowPath = (offset: number, containerHeight: number, layerOffset: number) => {
    const path: string[] = []
    // Start at bottom-left corner of container
    path.push(`M 0 ${containerHeight}`)
    
    // Use more points and smoother curves for better smoothness
    const numPoints = 40
    const points: Array<{ x: number; y: number }> = []
    
    for (let i = 0; i <= numPoints; i++) {
      const x = (i / numPoints) * 400
      const progress = i / numPoints
      
      // Ground type locked wave patterns - terrain-like with moderate choppiness
      const wave1 = Math.sin(progress * Math.PI * groundTypeWaveFrequency + groundTypeOffset + offset) * (groundTypeWaveIntensity + layerOffset * 0.3)
      const wave2 = Math.cos(progress * Math.PI * (groundTypeWaveFrequency * 1.4) + groundTypeOffset * 1.2 + offset * 1.2) * (groundTypeWaveIntensity * 0.5 + layerOffset * 0.2)
      const wave3 = Math.sin(progress * Math.PI * (groundTypeWaveFrequency * 2.0) + groundTypeOffset * 0.6 + offset * 0.6) * (groundTypeWaveIntensity * 0.3 + layerOffset * 0.15)
      
      // Ground type locked height variation (stable per post)
      const cardVariation = ((groundTypeIndex * 3 + i * 1.5) % 11) - 5
      const heightVariation = cardVariation * groundTypeHeightVariation
      
      // Calculate y position from bottom (containerHeight is the bottom)
      // Increased base height to prevent lows from being too low
      const snowHeight = 4 + layerOffset * 1.5
      const combinedWave = wave1 + wave2 + wave3
      // Clamp the combined wave to prevent it from going too low
      const clampedWave = Math.max(combinedWave, -1.5)
      const y = containerHeight - snowHeight + clampedWave + heightVariation
      
      points.push({ x, y })
    }
    
    // Use cubic Bezier curves for smoother transitions
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      
      if (i === 1) {
        // First segment - use line to start
        path.push(`L ${curr.x} ${curr.y}`)
      } else {
        // Use cubic Bezier for smooth curves
        const prevPrev = points[i - 2]
        const next = i < points.length - 1 ? points[i + 1] : curr
        
        // Calculate control points for smooth curve
        const cp1x = prev.x + (curr.x - prevPrev.x) * 0.3
        const cp1y = prev.y + (curr.y - prevPrev.y) * 0.3
        const cp2x = curr.x - (next.x - prev.x) * 0.3
        const cp2y = curr.y - (next.y - prev.y) * 0.3
        
        path.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`)
      }
    }
    
    // Close path back to bottom-right corner
    path.push(`L 400 ${containerHeight} Z`)
    return path.join(' ')
  }

  const containerHeight = groundTypeBaseHeight + 4

  return (
    <div
      className={cn(
        "absolute bottom-0 left-0 right-0 pointer-events-none overflow-visible",
        className
      )}
      style={{ height: `${containerHeight}px` }}
      aria-hidden="true"
    >
      {/* Natural snow buildup using SVG with height variation */}
      <svg
        className="absolute bottom-0 left-0 w-full h-full"
        viewBox={`0 0 400 ${containerHeight}`}
        preserveAspectRatio="none"
      >
        {/* Layer 1 - Bottom base layer */}
        <path
          d={generateSnowPath(0, containerHeight, 0)}
          fill="rgba(255, 255, 255, 0.65)"
        />
        {/* Layer 2 - Middle layer */}
        <path
          d={generateSnowPath(1.2, containerHeight, 1)}
          fill="rgba(255, 255, 255, 0.8)"
        />
        {/* Layer 3 - Top layer */}
        <path
          d={generateSnowPath(2.4, containerHeight, 2)}
          fill="rgba(255, 255, 255, 0.95)"
        />
        {/* Subtle highlight for natural shine */}
        <path
          d={`M 0 ${containerHeight} Q 100 ${containerHeight - 0.8}, 200 ${containerHeight} Q 300 ${containerHeight + 0.8}, 400 ${containerHeight}`}
          stroke="rgba(255, 255, 255, 0.4)"
          strokeWidth="0.4"
          fill="none"
        />
      </svg>
      
      {/* Snowman decoration - varied position per post, positioned on top of snow (right half only) */}
      <div 
        className="absolute"
        style={{ 
          right: `${100 - snowmanPositionPercent}%`,
          bottom: '-4px', // Position slightly below to sit on snow surface
          transform: `scale(${snowmanSize})`,
        }}
      >
        <svg width="32" height="40" viewBox="0 0 32 40" className="drop-shadow-sm">
          {/* Bottom snowball */}
          <circle cx="16" cy="32" r="6" fill="#ffffff" />
          {/* Middle snowball */}
          <circle cx="16" cy="24" r="5" fill="#ffffff" />
          {/* Top snowball */}
          <circle cx="16" cy="16" r="4" fill="#ffffff" />
          {/* Eyes */}
          <circle cx="14" cy="15" r="0.8" fill="#000000" />
          <circle cx="18" cy="15" r="0.8" fill="#000000" />
          {/* Carrot nose */}
          <path d="M 16 16 L 18 17 L 16.5 17 Z" fill="#ff8c42" />
          {/* Buttons */}
          <circle cx="16" cy="22" r="0.6" fill="#000000" />
          <circle cx="16" cy="24" r="0.6" fill="#000000" />
          {/* Left arm (static) */}
          <line x1="10" y1="24" x2="6" y2="22" stroke="#8B4513" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="6" cy="22" r="1" fill="#8B4513" />
          {/* Right arm (waving) */}
          <g className={isWaving ? "animate-wave" : ""}>
            <line x1="22" y1="24" x2="26" y2="20" stroke="#8B4513" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="26" cy="20" r="1" fill="#8B4513" />
          </g>
          {/* Santa hat */}
          <path d="M 12 12 Q 12 10, 14 10 Q 16 10, 18 10 Q 20 10, 20 12 L 20 13 Q 20 14, 18 14 L 14 14 Q 12 14, 12 13 Z" fill="#dc2626" />
          <circle cx="20" cy="13" r="1.5" fill="#ffffff" />
        </svg>
      </div>
      
      {/* Small decorative snowflakes scattered on top - varied count and positions */}
      <div className="absolute bottom-10 left-0 right-0 h-3">
        {Array.from({ length: snowflakeCount }).map((_, i) => {
          // More varied positioning that changes with animation frame
          const baseOffset = (variation + i * 3) % 15
          const frameOffset = (animationFrame * 2 + i) % 12
          const offset = (baseOffset + frameOffset) % 15
          const sizeVariation = 1.2 + ((variation + i + animationFrame) % 4) * 0.4
          return (
            <div
              key={i}
              className="absolute rounded-full bg-white/70 transition-all ease-in-out"
              style={{
                left: `${((i * (100 / Math.max(snowflakeCount, 1))) + offset * 2.5) % 100}%`,
                bottom: `${((i % 4) + (animationFrame % 3)) * 1.2}px`,
                width: `${sizeVariation}px`,
                height: `${sizeVariation}px`,
                boxShadow: `0 0 ${2 + (i % 3)}px rgba(255, 255, 255, 0.8)`,
                transitionDuration: '8000ms',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

