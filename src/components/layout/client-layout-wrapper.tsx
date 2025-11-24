"use client"

import { useState, useEffect, useRef } from "react"
import React from "react"
import { usePathname } from "next/navigation"
import { GlobalHeader } from "./global-header"
import { GlobalSidebar } from "./global-sidebar"
import { OnlineUsersSidebar } from "./online-users-sidebar"
import { MobileBottomNav } from "./mobile-bottom-nav"
import { MobileStatusBar } from "./mobile-status-bar"
import { ScrollToTop } from "@/components/scroll-to-top"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/toaster"
import { SnowEffect } from "@/components/snow-effect"
import { HolidayModeProvider } from "@/components/holiday-mode-context"
import type { HolidayMode } from "@/types/holiday"
import { DEFAULT_HOLIDAY_MODE } from "@/types/holiday"
import { GoogleOneTap } from "@/components/google-one-tap"
import dynamic from "next/dynamic"

// Dynamically import Silk with no SSR
const Silk = dynamic(() => import("@/components/Silk"), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-gradient-to-br from-[#0a0318] to-[#0d041f]" />
})

interface ClientLayoutWrapperProps {
  children: React.ReactNode
  holidayMode?: HolidayMode
}

export function ClientLayoutWrapper({ children, holidayMode = DEFAULT_HOLIDAY_MODE }: ClientLayoutWrapperProps) {
  const pathname = usePathname()
  // Initialize with false to match server-side rendering, then update in useEffect
  const [isMobile, setIsMobile] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const isDesktop = !isMobile && isMounted
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarPinned, setIsSidebarPinned] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const fullscreenTargetRef = useRef<HTMLDivElement | null>(null)
  const [hasResolvedScreenSize, setHasResolvedScreenSize] = useState(false)
  
  const isStreamPage = pathname?.includes('/stream')
  
  // Check if we're on a page where online users sidebar should be available
  // Returns object with shouldOpen and shouldPin
  const onlineUsersSidebarConfig = React.useMemo(() => {
    if (!pathname) return { shouldOpen: false, shouldPin: false }
    
    // Home page - pinned
    if (pathname === '/') return { shouldOpen: true, shouldPin: true }
    
    // Signup page (referral signup) - pinned like home page
    if (pathname.startsWith('/signup/')) return { shouldOpen: true, shouldPin: true }
    
    // Emails page - unpinned (floating)
    if (pathname === '/emails' || pathname.startsWith('/emails/')) {
      return { shouldOpen: false, shouldPin: false } // Closed by default, but available on hover
    }
    
    // Community pages - routes like /[slug] or /[slug]/*
    // Exclude known non-community routes
    const nonCommunityRoutes = ['/communities', '/create-community', '/settings', '/admin', '/account', '/profile', '/messages', '/wallet', '/storage', '/topup', '/emails', '/signup']
    const isNonCommunityRoute = nonCommunityRoutes.some(route => 
      pathname === route || pathname.startsWith(route + '/')
    )
    
    // If it's not a non-community route and not the home page, it's likely a community route
    // Community routes don't start with /admin and have a slug as the first segment
    if (!isNonCommunityRoute && !pathname.startsWith('/admin')) {
      // Check if it matches the pattern /[slug] or /[slug]/*
      const pathSegments = pathname.split('/').filter(Boolean)
      // If there's at least one segment and it's not a known route, it's a community route
      // Community pages: unpinned (floating) like emails page
      if (pathSegments.length > 0) {
        return { shouldOpen: false, shouldPin: false } // Unpinned, opens on hover
      }
    }
    
    return { shouldOpen: false, shouldPin: false }
  }, [pathname])
  
  // Initialize online users sidebar state - will be set by useEffect based on page
  const [isOnlineUsersSidebarOpen, setIsOnlineUsersSidebarOpen] = useState(false)
  const [isOnlineUsersSidebarPinned, setIsOnlineUsersSidebarPinned] = useState(false)
  const prevPathnameRef = useRef<string | null>(null)
  const hasInitializedRef = useRef(false)

  // Update online users sidebar state when pathname changes or screen size changes
  useEffect(() => {
    const pathnameChanged = prevPathnameRef.current !== pathname
    // Always update state when pathname or mobile state changes
    if (!hasResolvedScreenSize) {
      return
    }
    if (!hasInitializedRef.current || pathnameChanged) {
      prevPathnameRef.current = pathname
      hasInitializedRef.current = true
      // Set state based on page configuration
      const { shouldOpen, shouldPin } = onlineUsersSidebarConfig
      // CRITICAL: On mobile, never auto-open the sidebar - it should only open via button click
      // On desktop, respect the shouldOpen config (for home page and signup pages)
      setIsOnlineUsersSidebarOpen(isMobile ? false : shouldOpen)
      setIsOnlineUsersSidebarPinned(isMobile ? false : shouldPin)
    }
  }, [isMobile, onlineUsersSidebarConfig, pathname, hasResolvedScreenSize])

  // Set mounted state and initial mobile/desktop state after hydration
  useEffect(() => {
    setIsMounted(true)
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      
      // Set initial sidebar state based on screen size
      if (mobile) {
        setIsSidebarPinned(false)
        setIsSidebarOpen(false)
      } else {
        setIsSidebarPinned(true)
        setIsSidebarOpen(true)
      }
    }
    
    checkMobile()
    setHasResolvedScreenSize(true)
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle screen size changes after initial mount
  useEffect(() => {
    if (!isMounted) return
    
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      setHasResolvedScreenSize(true)
      
      if (mobile && !isMobile) {
        // Switching to mobile - close both sidebars
        setIsSidebarPinned(false)
        setIsSidebarOpen(false)
      } else if (!mobile && isMobile) {
        // Switching to desktop - open main sidebar
        setIsSidebarPinned(true)
        setIsSidebarOpen(true)
        // Online users sidebar will be handled by the other useEffect based on page
      }
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [isMobile, isMounted])

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

    // Register service worker with version-based cache busting
    const registerSW = async () => {
      try {
        // Register service worker - cache headers ensure fresh fetch
        // updateViaCache: "none" forces browser to check for updates
        // The service worker route includes ETag and version headers for cache busting
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none", // Always check for updates, bypass HTTP cache
        })

        // Check for updates immediately
        registration.update()

        // Listen for service worker updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New service worker is available
              console.log("[PWA] New service worker available")
              // Force activation
              newWorker.postMessage({ type: "SKIP_WAITING" })
            }
          })
        })

        // Listen for controller change (new SW activated)
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          console.log("[PWA] Service worker updated, reloading page")
          // Reload to get the latest version
          window.location.reload()
        })

        // Periodically check for updates (every 5 minutes)
        setInterval(() => {
          registration.update()
        }, 5 * 60 * 1000)

        // Check for updates on page visibility change
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) {
            registration.update()
          }
        })
      } catch (error) {
        console.error("[PWA] Service worker registration failed", error)
      }
    }

    registerSW()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!isMobile) return

    const prefersReducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (prefersReducedMotionQuery.matches) return

    const coarsePointerQuery = window.matchMedia("(pointer: coarse)")
    if (!coarsePointerQuery.matches) return

    let scrollableElement = document.querySelector('[data-scrollable-content]') as HTMLElement | null
    if (!scrollableElement) {
      scrollableElement = document.querySelector('main[class*="overflow-y-auto"]') as HTMLElement | null
    }
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

  const handleOnlineUsersSidebarToggle = () => {
    const newOpenState = !isOnlineUsersSidebarOpen
    setIsOnlineUsersSidebarOpen(newOpenState)
    // When toggling via button, pin/unpin it
    setIsOnlineUsersSidebarPinned(newOpenState)
  }

  const handleSidebarClose = () => setIsSidebarOpen(false)
  const handleOnlineUsersSidebarClose = () => {
    setIsOnlineUsersSidebarOpen(false)
    // When closing, also unpin if it was pinned
    if (isOnlineUsersSidebarPinned) {
      setIsOnlineUsersSidebarPinned(false)
    }
  }
  const handleTogglePin = () => setIsSidebarPinned(!isSidebarPinned)

  const onlineUsersSidebarHoverRef = useRef(false)
  const onlineUsersSidebarCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleOnlineUsersSidebarHoverChange = (isHovered: boolean) => {
    if (!isMobile && !isOnlineUsersSidebarPinned) {
      // Clear any pending close timeout whenever hover state changes
      if (onlineUsersSidebarCloseTimeoutRef.current) {
        clearTimeout(onlineUsersSidebarCloseTimeoutRef.current)
        onlineUsersSidebarCloseTimeoutRef.current = null
      }

      onlineUsersSidebarHoverRef.current = isHovered

      if (isHovered) {
        // Open on hover (unpinned/floating mode)
        if (!isOnlineUsersSidebarOpen) {
          setIsOnlineUsersSidebarOpen(true)
        }
      } else {
        // Close with a delay to allow mouse to move between trigger and sidebar
        // Only close if we're still not hovering after the delay
        onlineUsersSidebarCloseTimeoutRef.current = setTimeout(() => {
          // Double-check that we're still not hovering and not pinned
          if (!onlineUsersSidebarHoverRef.current && !isOnlineUsersSidebarPinned) {
            setIsOnlineUsersSidebarOpen(false)
          }
        }, 200)
      }
    }
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (onlineUsersSidebarCloseTimeoutRef.current) {
        clearTimeout(onlineUsersSidebarCloseTimeoutRef.current)
      }
    }
  }, [])

  const handleSidebarHoverChange = (isHovered: boolean) => {
    if (!isMobile && !isSidebarPinned && isHovered) {
      setIsSidebarOpen(true)
    }
  }

  const pageAreaClasses = cn(
    "transition-all duration-300 ease-in-out",
    {
      "pt-0 pb-0 ml-0 mr-0": isStreamPage,
      "pt-0": !isStreamPage, // No padding on main - handled by inner wrapper
      "ml-64": !isStreamPage && isSidebarPinned && !isMobile,
      "ml-0": !isStreamPage && ((!isSidebarPinned && !isMobile) || isMobile),
      "pb-12": !isStreamPage && isMobile, // Bottom padding for mobile bottom nav
    }
  )
  
  // Calculate right margin for online users sidebar on desktop when pinned (not when floating/unpinned)
  // When unpinned and opened via hover, it should hover over content without pushing it
  // Add extra margin (0.5rem = 8px) to account for scrollbar width (6px) + small gap
  const contentRightMargin = !isStreamPage && !isMobile && isOnlineUsersSidebarPinned ? '16.5rem' : '0'

  return (
    <HolidayModeProvider mode={holidayMode}>
    <div
      ref={fullscreenTargetRef}
      className="bg-background flex flex-col relative overflow-hidden"
      style={{
        // In fullscreen mode, use 100vh to fill the fullscreen viewport
        // Otherwise use 100dvh for normal viewport
        height: isFullscreen && isMobile ? "100vh" : "100dvh",
        minHeight: isFullscreen && isMobile ? "100vh" : "100dvh",
        // In fullscreen mode on mobile, remove all padding to allow content into notch area
        paddingTop: isFullscreen && isMobile ? "0" : "env(safe-area-inset-top, 0)",
        paddingBottom: isFullscreen && isMobile
          ? "0"
          : "env(safe-area-inset-bottom, 0)",
        paddingLeft: isFullscreen && isMobile ? "0" : "env(safe-area-inset-left, 0)",
        paddingRight: isFullscreen && isMobile ? "0" : "env(safe-area-inset-right, 0)",
      }}
    >
      {/* Silk Background - On all pages */}
      {!isStreamPage && (
        <div 
          className="fixed z-0 overflow-hidden opacity-100"
          style={{
            // In fullscreen mode, background should stretch to full viewport including notch area
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100%",
            height: "100%",
          }}
        >
          <div className="w-full h-full">
            <Silk
              key={pathname}
              speed={pathname === '/' ? 1.5 : 0.3}
              scale={1}
              color={pathname === '/' ? "#7004dc" : "#2d0354"}
              noiseIntensity={1.5}
              rotation={0}
            />
          </div>
        </div>
      )}
      
      {/* Snow Effect - Christmas theme (December & January) */}
      {/* {!isStreamPage && <SnowEffect />} */}
      
      {!isStreamPage && (
        <>
          <MobileStatusBar isFullscreen={isFullscreen} isMobile={isMobile} />
          <GlobalHeader
            onMenuClick={handleMenuClick}
            isSidebarOpen={isSidebarOpen}
            isMobile={isMobile}
            fullscreenTargetRef={fullscreenTargetRef}
            onOnlineUsersSidebarToggle={handleOnlineUsersSidebarToggle}
            isOnlineUsersSidebarOpen={isOnlineUsersSidebarOpen}
          />
          
          <GlobalSidebar
            isOpen={isSidebarOpen}
            onClose={handleSidebarClose}
            isPinned={isSidebarPinned}
            onTogglePin={handleTogglePin}
            onHoverChange={handleSidebarHoverChange}
            isMobile={isMobile}
            isFullscreen={isFullscreen}
          />

          {/* Online Users Sidebar - Available on all pages */}
          <OnlineUsersSidebar
            isMobile={isMobile}
            isOpen={isOnlineUsersSidebarOpen}
            isPinned={isOnlineUsersSidebarPinned}
            onClose={handleOnlineUsersSidebarClose}
            onHoverChange={handleOnlineUsersSidebarHoverChange}
            isFullscreen={isFullscreen}
          />

          {isMobile && isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[950] transition-opacity duration-300"
              onClick={handleSidebarClose}
              aria-hidden="true"
            />
          )}
          
          {isMobile && isOnlineUsersSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[950] transition-opacity duration-300"
              onClick={handleOnlineUsersSidebarClose}
              aria-hidden="true"
            />
          )}
        </>
      )}

      <main
        data-scrollable-content
        className={cn(
          pageAreaClasses, 
          isFullscreen && isMobile 
            ? "absolute inset-0 z-10 flex flex-col" 
            : "flex-1 relative z-10 min-h-0 flex flex-col"
        )}
        style={{
          marginRight: contentRightMargin,
        }}
      >
        {isStreamPage ? (
          children
        ) : (
          <div 
            className={cn(
              "absolute inset-0 overflow-y-auto pl-3 pr-2.5 sm:pl-4 sm:pr-3.5 lg:pl-6 lg:pr-5",
              isMobile ? "pb-16" : "pb-4" // Extra padding on mobile for bottom nav (48px nav + 16px spacing = 64px)
            )}
            style={(() => {
              // In fullscreen mode on mobile, start content from the very top (no safe area offset)
              // Content can extend into the notch area
              if (isFullscreen && isMobile) {
                return {
                  // Start from the very top of the viewport (into notch area)
                  top: "0",
                  left: "0",
                  right: "0",
                  bottom: "0",
                  // Add padding to account for header position and height
                  // Header is at: calc(env(safe-area-inset-top, 0) + 8px), height: 3rem
                  // Add extra spacing (12px) so content isn't hidden behind header
                  paddingTop: "calc(env(safe-area-inset-top, 0) + 8px + 3rem + 12px)",
                }
              }
              return {
                top: "0",
                paddingTop: "16px",
              }
            })()}
          >
            {children}
          </div>
        )}
      </main>

      {!isStreamPage && <MobileBottomNav isMobile={isMobile} />}

      <div
        id="google-one-tap-anchor"
        className="fixed top-2 right-2 z-[2147483646] flex items-start justify-end"
        aria-hidden="true"
      />
      <GoogleOneTap />
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
    </HolidayModeProvider>
  )
}