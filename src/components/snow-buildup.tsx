"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { useIsChristmasMode } from "@/components/holiday-mode-context"

/**
 * Snow buildup effect for the bottom of cards
 * Creates a decorative snow accumulation effect with a snowman
 * Each card gets a unique variation
 */
export function SnowBuildup({ className, cardId }: { className?: string; cardId?: string }) {
  const isChristmasSeason = useIsChristmasMode()

  // Generate a consistent variation based on cardId or random seed
  const variation = useMemo(() => {
    if (cardId) {
      // Use cardId to generate consistent variation
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

  if (!isChristmasSeason) return null

  // Variation settings
  const baseHeight = 18 + ((variation % 5) * 1.5) // 18, 19.5, 21, 22.5, or 24
  const snowflakeCount = 5 + (variation % 4) // 5-8 snowflakes
  const snowmanPosition = (variation % 2) + 1 // 1 = right-center, 2 = right-edge (right half only)
  const snowmanSize = 0.85 + ((variation % 3) * 0.1) // 0.85, 0.95, or 1.05

  // Generate natural snow buildup path with smooth curves
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
      
      // Smoother wave patterns with reduced amplitude
      const wave1 = Math.sin(progress * Math.PI * 2.5 + offset) * (1.5 + layerOffset * 0.5)
      const wave2 = Math.cos(progress * Math.PI * 4 + offset * 1.2) * (0.8 + layerOffset * 0.3)
      const wave3 = Math.sin(progress * Math.PI * 6 + offset * 0.6) * (0.5 + layerOffset * 0.2)
      
      // Smoother variation based on card ID
      const cardVariation = ((variation + i * 1.5) % 9) - 4
      const heightVariation = cardVariation * 0.3
      
      // Calculate y position from bottom (containerHeight is the bottom)
      const snowHeight = 3 + layerOffset * 1.5
      const y = containerHeight - snowHeight + wave1 + wave2 + wave3 + heightVariation
      
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

  const containerHeight = baseHeight + 4

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
      
      {/* Snowman decoration - varied position and size, positioned on top of snow (right half only) */}
      <div 
        className={cn(
          "absolute",
          snowmanPosition === 1 ? 'right-1/2' : 'right-8' // right-center or right-edge
        )} 
        style={{ 
          bottom: '-4px', // Position slightly below to sit on snow surface
          transform: `${snowmanPosition === 1 ? 'translateX(50%)' : ''} scale(${snowmanSize})`,
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
          {/* Santa hat */}
          <path d="M 12 12 Q 12 10, 14 10 Q 16 10, 18 10 Q 20 10, 20 12 L 20 13 Q 20 14, 18 14 L 14 14 Q 12 14, 12 13 Z" fill="#dc2626" />
          <circle cx="20" cy="13" r="1.5" fill="#ffffff" />
        </svg>
      </div>
      
      {/* Small decorative snowflakes scattered on top - varied count */}
      <div className="absolute bottom-10 left-0 right-0 h-3">
        {Array.from({ length: snowflakeCount }).map((_, i) => {
          const offset = (variation + i) % 10
          return (
            <div
              key={i}
              className="absolute rounded-full bg-white/70"
              style={{
                left: `${((i * (100 / snowflakeCount)) + offset) % 100}%`,
                bottom: `${(i % 3) * 1}px`,
                width: `${1.5 + (i % 2)}px`,
                height: `${1.5 + (i % 2)}px`,
                boxShadow: `0 0 ${2 + (i % 2)}px rgba(255, 255, 255, 0.8)`,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

