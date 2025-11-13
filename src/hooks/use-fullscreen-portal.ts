"use client"

import { useEffect, useState } from "react"

/**
 * Hook to get the correct portal container for Radix UI components
 * When in fullscreen mode, portals should render inside the fullscreen element
 * Otherwise, they render to document.body (default)
 * 
 * This is the proper way to handle portals in fullscreen mode according to
 * Radix UI documentation - use the container prop on Portal components
 */
export function useFullscreenPortal() {
  const [container, setContainer] = useState<HTMLElement | undefined>(undefined)

  useEffect(() => {
    if (typeof document === "undefined") return

    const updateContainer = () => {
      const doc = document as any
      const fullscreenElement =
        (doc.fullscreenElement ||
          doc.webkitFullscreenElement ||
          doc.mozFullScreenElement ||
          doc.msFullscreenElement) as HTMLElement | null

      // If in fullscreen, use the fullscreen element as container
      // Otherwise, undefined means Radix UI will use document.body (default)
      setContainer(fullscreenElement || undefined)
    }

    // Check initial state
    updateContainer()

    // Listen for fullscreen changes
    const events = [
      "fullscreenchange",
      "webkitfullscreenchange",
      "mozfullscreenchange",
      "MSFullscreenChange",
    ] as const

    events.forEach((event) => {
      document.addEventListener(event, updateContainer)
    })

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, updateContainer)
      })
    }
  }, [])

  return container
}

