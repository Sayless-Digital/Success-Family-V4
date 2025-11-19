"use client"

import Snowfall from "react-snowfall"
import { useIsChristmasMode } from "@/components/holiday-mode-context"

/**
 * Snow effect component for Christmas theme
 * Uses react-snowfall library for optimized performance
 * Shows during December and January, or can be enabled year-round
 * 
 * To make it seasonal only, change the condition in useEffect
 */
export function SnowEffect() {
  const isChristmasSeason = useIsChristmasMode()

  if (!isChristmasSeason) return null

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[5] overflow-hidden"
      aria-hidden="true"
    >
      <Snowfall
        color="rgba(255, 255, 255, 0.8)"
        snowflakeCount={80}
        speed={[0.1, 0.5]}
        wind={[-0.5, 0.5]}
        radius={[1.5, 4]}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  )
}

