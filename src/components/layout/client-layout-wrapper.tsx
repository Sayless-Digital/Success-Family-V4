"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { GlobalHeader } from "./global-header"
import { GlobalSidebar } from "./global-sidebar"
import { MobileBottomNav } from "./mobile-bottom-nav"
import { ScrollToTop } from "@/components/scroll-to-top"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/toaster"
import dynamic from "next/dynamic"

// Dynamically import Silk with no SSR
const Silk = dynamic(() => import("@/components/Silk"), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-gradient-to-br from-[#0a0318] to-[#0d041f]" />
})

interface ClientLayoutWrapperProps {
  children: React.ReactNode
}

export function ClientLayoutWrapper({ children }: ClientLayoutWrapperProps) {
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarPinned, setIsSidebarPinned] = useState(false)
  const [isMobile, setIsMobile] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const fullscreenTargetRef = useRef<HTMLDivElement | null>(null)
  
  const isStreamPage = pathname?.includes('/stream')
  const isHomePage = pathname === '/'

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      const wasFirstRun = isMobile === true && isSidebarPinned === false && isSidebarOpen === false
      
      setIsMobile(mobile)
      
      if (wasFirstRun) {
        if (mobile) {
          setIsSidebarPinned(false)
          setIsSidebarOpen(false)
        } else {
          setIsSidebarPinned(true)
          setIsSidebarOpen(true)
        }
      } else if (mobile && !isMobile) {
        setIsSidebarPinned(false)
        setIsSidebarOpen(false)
      }
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (typeof document === "undefined") return

    const updateFullscreenState = () => {
      const doc = document as any
      const fullscreenElement =
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement

      setIsFullscreen(Boolean(fullscreenElement))
    }

    const vendorEvents = ["webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"] as const

    document.addEventListener("fullscreenchange", updateFullscreenState)
    vendorEvents.forEach((event) => document.addEventListener(event as any, updateFullscreenState))

    updateFullscreenState()

    return () => {
      document.removeEventListener("fullscreenchange", updateFullscreenState)
      vendorEvents.forEach((event) => document.removeEventListener(event as any, updateFullscreenState))
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    const isSecureOrigin =
      window.location.protocol === "https:" || window.location.hostname === "localhost"

    if (!isSecureOrigin) return

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((error) => {
        console.error("[PWA] Service worker registration failed", error)
      })
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!isMobile) return

    const prefersReducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (prefersReducedMotionQuery.matches) return

    const coarsePointerQuery = window.matchMedia("(pointer: coarse)")
    if (!coarsePointerQuery.matches) return

    const scrollableElement = document.querySelector('main[class*="overflow-y-auto"]') as HTMLElement | null
    if (!scrollableElement) return

    const multiplier = 1.3
    let lastTouchY: number | null = null

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        lastTouchY = null
        return
      }

      lastTouchY = event.touches[0].clientY
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (lastTouchY === null || event.touches.length !== 1) {
        return
      }

      const currentY = event.touches[0].clientY
      const deltaY = lastTouchY - currentY

      if (Math.abs(deltaY) > 0.5) {
        scrollableElement.scrollTop += deltaY * (multiplier - 1)
      }

      lastTouchY = currentY
    }

    const resetTouch = () => {
      lastTouchY = null
    }

    scrollableElement.addEventListener("touchstart", handleTouchStart, { passive: true })
    scrollableElement.addEventListener("touchmove", handleTouchMove, { passive: true })
    scrollableElement.addEventListener("touchend", resetTouch)
    scrollableElement.addEventListener("touchcancel", resetTouch)

    return () => {
      scrollableElement.removeEventListener("touchstart", handleTouchStart)
      scrollableElement.removeEventListener("touchmove", handleTouchMove)
      scrollableElement.removeEventListener("touchend", resetTouch)
      scrollableElement.removeEventListener("touchcancel", resetTouch)
    }
  }, [isMobile, pathname])

  const handleMenuClick = () => {
    if (isMobile) {
      setIsSidebarOpen(!isSidebarOpen)
    } else {
      const newPinnedState = !isSidebarPinned
      setIsSidebarPinned(newPinnedState)
      setIsSidebarOpen(newPinnedState)
    }
  }

  const handleSidebarClose = () => setIsSidebarOpen(false)
  const handleTogglePin = () => setIsSidebarPinned(!isSidebarPinned)

  const handleSidebarHoverChange = (isHovered: boolean) => {
    if (!isMobile && !isSidebarPinned && isHovered) {
      setIsSidebarOpen(true)
    }
  }

  const pageAreaClasses = cn(
    "transition-all duration-300 ease-in-out",
    {
      "pt-0 pb-0 ml-0": isStreamPage,
      "pt-12": !isStreamPage,
      "ml-64": !isStreamPage && isSidebarPinned && !isMobile,
      "ml-0": !isStreamPage && ((!isSidebarPinned && !isMobile) || isMobile),
      "pb-12": !isStreamPage && isMobile,
    }
  )

  return (
    <div
      ref={fullscreenTargetRef}
      className="min-h-dvh bg-background overflow-x-hidden flex flex-col relative"
      style={{
        paddingTop: "env(safe-area-inset-top, 0)",
        paddingBottom: isFullscreen && isMobile
          ? "calc(env(safe-area-inset-bottom, 0) + 64px)"
          : "env(safe-area-inset-bottom, 0)",
        paddingLeft: "env(safe-area-inset-left, 0)",
        paddingRight: "env(safe-area-inset-right, 0)",
      }}
    >
      {/* Silk Background - On all pages */}
      {!isStreamPage && (
        <div className="fixed inset-0 z-0 overflow-hidden w-full h-full opacity-100">
          <div className="w-full h-full">
            <Silk
              key={pathname}
              speed={5}
              scale={1}
              color={isHomePage ? "#7004dc" : "#2d0354"}
              noiseIntensity={1.5}
              rotation={0}
            />
          </div>
        </div>
      )}
      
      {!isStreamPage && (
        <>
          <GlobalHeader
            onMenuClick={handleMenuClick}
            isSidebarOpen={isSidebarOpen}
            isMobile={isMobile}
            fullscreenTargetRef={fullscreenTargetRef}
          />
          
          <GlobalSidebar
            isOpen={isSidebarOpen}
            onClose={handleSidebarClose}
            isPinned={isSidebarPinned}
            onTogglePin={handleTogglePin}
            onHoverChange={handleSidebarHoverChange}
            isMobile={isMobile}
          />

          {isMobile && isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[950] transition-opacity duration-300"
              onClick={handleSidebarClose}
              aria-hidden="true"
            />
          )}
        </>
      )}

      <main className={cn(pageAreaClasses, "flex-1 relative z-10 overflow-y-auto min-h-0 flex flex-col")}>
        {isStreamPage ? (
          children
        ) : (
          <div className="pt-4 pb-4 px-4 sm:px-6 lg:px-8 flex-1 flex flex-col">
            {children}
          </div>
        )}
      </main>

      {!isStreamPage && <MobileBottomNav isMobile={isMobile} />}
      
      <ScrollToTop />
      
      <Toaster
        key={isMobile ? 'mobile' : 'desktop'}
        position="bottom-center"
        offset={isStreamPage ? "0.5rem" : (isMobile ? "3rem" : "0.5rem")}
        theme="dark"
        toastOptions={{
          style: {
            background: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            backdropFilter: 'blur(16px)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            marginLeft: !isStreamPage && isSidebarPinned && !isMobile ? '8rem' : '0',
            marginBottom: !isStreamPage && isMobile ? '3rem' : undefined,
          },
        }}
      />
    </div>
  )
}