"use client"

import { useEffect, useState, useRef } from "react"
import { cn } from "@/lib/utils"

interface ChristmasLightsProps {
  className?: string
  lightCount?: number
  spacing?: number
  edges?: 'all' | 'bottom' | 'top' | 'left' | 'right' // Which edges to show lights on
}

/**
 * Christmas lights decoration
 * Creates blinking lights along the top edge of a container
 * Lights are evenly spaced across the top
 */
export function ChristmasLights({ 
  className, 
  lightCount = 24,
  spacing = 12,
  edges = 'all'
}: ChristmasLightsProps) {
  const [isChristmasSeason, setIsChristmasSeason] = useState(true) // Default to always show
  const containerRef = useRef<HTMLDivElement>(null)
  const [lightPositions, setLightPositions] = useState<Array<{ x: number; y: number; color: string; delay: number; rotation: number }>>([])

  useEffect(() => {
    // Uncomment below to make it seasonal (December & January only):
    // const now = new Date()
    // const month = now.getMonth() // 0-11, where 0 is January
    // setIsChristmasSeason(month === 11 || month === 0) // December or January
  }, [])

  useEffect(() => {
    if (!containerRef.current || !isChristmasSeason) return

    const updatePositions = () => {
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const width = rect.width
      const height = rect.height
      
      if (width === 0 || height === 0) {
        // Container not ready yet, try again
        setTimeout(updatePositions, 50)
        return
      }
      
      // Calculate perimeter or single edge length based on edges prop
      let edgeLength = 0
      if (edges === 'all') {
        edgeLength = 2 * (width + height)
      } else if (edges === 'top' || edges === 'bottom') {
        edgeLength = width
      } else {
        edgeLength = height
      }
      
      // Calculate spacing between lights - evenly distribute along selected edge(s)
      const totalLights = Math.min(lightCount, Math.floor(edgeLength / spacing))
      const actualSpacing = edgeLength / totalLights
      const perimeter = 2 * (width + height) // Keep full perimeter for distance calculation
      
      // Christmas light colors
      const colors = [
        '#ff0000', // Red
        '#00ff00', // Green
        '#ffff00', // Yellow
        '#ff00ff', // Magenta
        '#00ffff', // Cyan
        '#ff8800', // Orange
        '#ff0088', // Pink
        '#0088ff', // Blue
      ]

      const positions: Array<{ x: number; y: number; color: string; delay: number; rotation: number }> = []
      const topOffset = 6 // Offset inward from top edge
      const bottomOffset = -4 // Negative offset - below bottom edge

      // If only showing one edge, simplify the logic
      if (edges === 'bottom') {
        const startOffset = 8 // Start lights a bit in from the left edge
        const endOffset = 0 // No offset on right edge - extend to the end
        const availableWidth = width - startOffset - endOffset
        const adjustedSpacing = availableWidth / totalLights
        
        for (let i = 0; i < totalLights; i++) {
          const x = startOffset + (i * adjustedSpacing)
          const y = height - bottomOffset
          const tiltVariation = ((i * 7) % 31) - 15
          
          positions.push({
            x,
            y,
            color: colors[i % colors.length],
            delay: (i * 0.1) % 1,
            rotation: tiltVariation
          })
        }
      } else if (edges === 'top') {
        for (let i = 0; i < totalLights; i++) {
          const x = i * actualSpacing
          const y = topOffset
          const tiltVariation = ((i * 7) % 31) - 15
          
          positions.push({
            x,
            y,
            color: colors[i % colors.length],
            delay: (i * 0.1) % 1,
            rotation: tiltVariation
          })
        }
      } else if (edges === 'left') {
        for (let i = 0; i < totalLights; i++) {
          const x = 0
          const y = i * actualSpacing
          const tiltVariation = ((i * 7) % 31) - 15
          
          positions.push({
            x,
            y,
            color: colors[i % colors.length],
            delay: (i * 0.1) % 1,
            rotation: tiltVariation
          })
        }
      } else if (edges === 'right') {
        for (let i = 0; i < totalLights; i++) {
          const x = width
          const y = i * actualSpacing
          const tiltVariation = ((i * 7) % 31) - 15
          
          positions.push({
            x,
            y,
            color: colors[i % colors.length],
            delay: (i * 0.1) % 1,
            rotation: tiltVariation
          })
        }
      } else {
        // All edges - use the full perimeter logic
        let distance = 0
        for (let i = 0; i < totalLights; i++) {
        let x = 0
        let y = 0

        // Determine which edge we're on based on distance
        // Handle corners explicitly
        if (Math.abs(distance - 0) < 0.1 || Math.abs(distance - perimeter) < 0.1) {
          // Top-left corner
          x = 0
          y = topOffset
        } else if (Math.abs(distance - width) < 0.1) {
          // Top-right corner
          x = width
          y = topOffset
        } else if (Math.abs(distance - (width + height)) < 0.1) {
          // Bottom-right corner
          x = width
          y = height - bottomOffset
        } else if (Math.abs(distance - (2 * width + height)) < 0.1) {
          // Bottom-left corner
          x = 0
          y = height - bottomOffset
        } else if (distance < width) {
          // Top edge - stub on top, bulb hangs down
          x = distance
          y = topOffset
        } else if (distance < width + height) {
          // Right edge - stub on right, bulb hangs down (no offset)
          x = width
          y = distance - width
        } else if (distance < 2 * width + height) {
          // Bottom edge - stub on bottom, bulb hangs down
          x = width - (distance - width - height)
          y = height - bottomOffset
        } else {
          // Left edge - stub on left, bulb hangs down (no offset)
          x = 0
          y = height - (distance - 2 * width - height)
        }

        // Determine which edge this position is on
        let edgeType: 'top' | 'right' | 'bottom' | 'left' | 'corner' = 'top'
        if (Math.abs(distance - 0) < 0.1 || Math.abs(distance - perimeter) < 0.1 ||
            Math.abs(distance - width) < 0.1 || Math.abs(distance - (width + height)) < 0.1 ||
            Math.abs(distance - (2 * width + height)) < 0.1) {
          edgeType = 'corner'
        } else if (distance < width) {
          edgeType = 'top'
        } else if (distance < width + height) {
          edgeType = 'right'
        } else if (distance < 2 * width + height) {
          edgeType = 'bottom'
        } else {
          edgeType = 'left'
        }

        // Filter based on edges prop
        const shouldInclude = edges === 'all' || 
          (edges === 'top' && (edgeType === 'top' || edgeType === 'corner')) ||
          (edges === 'bottom' && (edgeType === 'bottom' || edgeType === 'corner')) ||
          (edges === 'left' && (edgeType === 'left' || edgeType === 'corner')) ||
          (edges === 'right' && (edgeType === 'right' || edgeType === 'corner'))

        if (!shouldInclude) {
          distance += actualSpacing
          if (distance >= perimeter) distance = 0
          continue
        }

        // Add exaggerated tilt variation based on index
        const tiltVariation = ((i * 7) % 31) - 15 // Range from -15 to +15 degrees
        
        positions.push({
          x,
          y,
          color: colors[i % colors.length],
          delay: (i * 0.1) % 1, // Staggered delays for blinking
          rotation: tiltVariation // Slight varied tilt
        })

          distance += actualSpacing
          if (distance >= perimeter) distance = 0 // Wrap around
        }
      }

      setLightPositions(positions)
    }

    // Use requestAnimationFrame to ensure container is rendered
    requestAnimationFrame(() => {
      updatePositions()
    })
    
    window.addEventListener('resize', updatePositions)
    return () => window.removeEventListener('resize', updatePositions)
  }, [lightCount, spacing, isChristmasSeason])

  if (!isChristmasSeason) return null

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute inset-0 pointer-events-none overflow-visible rounded-lg",
        className
      )}
      aria-hidden="true"
    >
      {/* Christmas light bulbs - all around */}
      {lightPositions.map((pos, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            transform: `translate(-50%, -50%) rotate(${pos.rotation}deg)`,
            zIndex: 2,
          }}
        >
          {/* Bulb shape */}
          <svg width="12" height="16" viewBox="0 0 12 16" style={{ filter: `drop-shadow(0 0 4px ${pos.color})` }}>
            {/* Bulb stub/base - always visible */}
            <rect x="4" y="0" width="4" height="3" rx="1" fill="rgba(255, 255, 255, 0.4)" />
            {/* Bulb body - only this part blinks */}
            <g className="animate-blink" style={{ animationDelay: `${pos.delay}s` }}>
              <ellipse cx="6" cy="8" rx="4" ry="5" fill={pos.color} />
              {/* Bulb highlight */}
              <ellipse cx="5" cy="7" rx="1.5" ry="2" fill="rgba(255, 255, 255, 0.5)" />
            </g>
          </svg>
        </div>
      ))}
    </div>
  )
}

