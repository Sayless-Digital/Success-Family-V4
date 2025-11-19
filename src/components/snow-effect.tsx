"use client"

import { useEffect, useState } from "react"
import Snowfall from "react-snowfall"

/**
 * Snow effect component for Christmas theme
 * Uses react-snowfall library for optimized performance
 * Shows during December and January, or can be enabled year-round
 * 
 * To make it seasonal only, change the condition in useEffect
 */
export function SnowEffect() {
  const [isChristmasSeason, setIsChristmasSeason] = useState(true) // Default to always show

  useEffect(() => {
    // Uncomment below to make it seasonal (December & January only):
    // const now = new Date()
    // const month = now.getMonth() // 0-11, where 0 is January
    // setIsChristmasSeason(month === 11 || month === 0) // December or January
  }, [])

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

