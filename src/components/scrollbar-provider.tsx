"use client"

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { OverlayScrollbars } from 'overlayscrollbars'
import 'overlayscrollbars/overlayscrollbars.css'

interface ScrollbarProviderProps {
  children: React.ReactNode
}

export function ScrollbarProvider({ children }: ScrollbarProviderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<OverlayScrollbars | null>(null)
  const pathname = usePathname()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || instanceRef.current) return

    if (containerRef.current && !instanceRef.current) {
      instanceRef.current = OverlayScrollbars(containerRef.current, {
        scrollbars: {
          theme: 'custom-overlay',
          visibility: 'auto',
          autoHide: 'move',
          autoHideDelay: 200,
          dragScrolling: true,
          clickScrolling: false,
          touchSupport: true,
          snapHandle: false,
        },
        overflow: {
          x: 'hidden',
          y: 'scroll',
        },
        paddingAbsolute: false,
        showNativeOverlaidScrollbars: false,
      })
    }

    return () => {
      if (instanceRef.current) {
        instanceRef.current.destroy()
        instanceRef.current = null
      }
    }
  }, [isClient])

  useEffect(() => {
    if (instanceRef.current && isClient) {
      instanceRef.current.update()
    }
  }, [pathname, isClient])

  return (
    <div ref={containerRef} className="h-screen w-full">
      {children}
    </div>
  )
}

