"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { GlobalHeader } from "./global-header"
import { GlobalSidebar } from "./global-sidebar"
import { MobileBottomNav } from "./mobile-bottom-nav"
import { ScrollToTop } from "@/components/scroll-to-top"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/toaster"
import Silk from "@/components/Silk"

interface GlobalLayoutProps {
  children: React.ReactNode
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarPinned, setIsSidebarPinned] = useState(false)
  const [isMobile, setIsMobile] = useState(true) // Assume mobile first to avoid flash
  
  // Check if we're on a stream page (hide nav elements for immersive experience)
  const isStreamPage = pathname?.includes('/stream')

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      const wasFirstRun = isMobile === true && isSidebarPinned === false && isSidebarOpen === false
      
      setIsMobile(mobile)
      
      // Only set initial state on first run
      if (wasFirstRun) {
        if (mobile) {
          // Mobile: keep closed
          setIsSidebarPinned(false)
          setIsSidebarOpen(false)
        } else {
          // Desktop: open pinned sidebar
          setIsSidebarPinned(true)
          setIsSidebarOpen(true)
        }
      } else if (mobile && !isMobile) {
        // Switched from desktop to mobile
        setIsSidebarPinned(false)
        setIsSidebarOpen(false)
      }
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleMenuClick = () => {
    if (isMobile) {
      // On mobile, toggle sidebar open/closed
      setIsSidebarOpen(!isSidebarOpen)
    } else {
      // On desktop, toggle pinned state
      const newPinnedState = !isSidebarPinned
      setIsSidebarPinned(newPinnedState)
      
      if (newPinnedState) {
        // If pinning, open the sidebar
        setIsSidebarOpen(true)
      } else {
        // If unpinning, close the sidebar
        setIsSidebarOpen(false)
      }
    }
  }

  const handleSidebarClose = () => {
    setIsSidebarOpen(false)
  }

  const handleTogglePin = () => {
    setIsSidebarPinned(!isSidebarPinned)
  }

  // Handle hover behavior for desktop unpinned sidebar
  const handleSidebarHoverChange = (isHovered: boolean) => {
    if (!isMobile && !isSidebarPinned && isHovered) {
      setIsSidebarOpen(true)
    }
  }

  // Calculate page area classes based on sidebar state
  const pageAreaClasses = cn(
    "transition-all duration-300 ease-in-out",
    {
      // Stream pages: no padding/margin (full screen)
      "pt-0 pb-0 ml-0": isStreamPage,
      // Normal pages: account for header and nav
      "pt-12": !isStreamPage,
      // Desktop pinned state - sidebar takes up space
      "ml-64": !isStreamPage && isSidebarPinned && !isMobile,
      // Desktop unpinned or mobile - no margin (sidebar is overlay)
      "ml-0": !isStreamPage && ((!isSidebarPinned && !isMobile) || isMobile),
      // Add bottom padding on mobile for bottom navigation (48px height)
      "pb-12": !isStreamPage && isMobile,
    }
  )

  return (
    <>
    <div className="h-dvh bg-background overflow-x-hidden flex flex-col relative">
      {/* Silk Background */}
      <div className="fixed inset-0 z-0 overflow-hidden w-full h-full">
        <div className="w-full h-full">
          <Silk
            speed={7.2}
            scale={1}
            color={isMobile ? "#0d041f" : "#0a0318"}
            noiseIntensity={1}
            rotation={0}
          />
        </div>
      </div>
      
      {/* Hide header and sidebar on stream pages */}
      {!isStreamPage && (
        <>
          <GlobalHeader
            onMenuClick={handleMenuClick}
            isSidebarOpen={isSidebarOpen}
            isMobile={isMobile}
          />
          
          <GlobalSidebar
            isOpen={isSidebarOpen}
            onClose={handleSidebarClose}
            isPinned={isSidebarPinned}
            onTogglePin={handleTogglePin}
            onHoverChange={handleSidebarHoverChange}
            isMobile={isMobile}
          />

          {/* Mobile Overlay with Blur */}
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
          // Stream pages: no padding, full screen
          children
        ) : (
          // Normal pages: with padding
          <div className="pt-4 pb-4 px-4 sm:px-6 lg:px-8 flex-1 flex flex-col">
            {children}
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation - hide on stream pages */}
      {!isStreamPage && <MobileBottomNav isMobile={isMobile} />}
      
      {/* Scroll to Top Button */}
      <ScrollToTop />
    </div>
    
    {/* Toaster is portaled to document.body with high z-index */}
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
            // Adjust position based on sidebar state (not on stream pages)
            marginLeft: !isStreamPage && isSidebarPinned && !isMobile ? '8rem' : '0',
            // Force bottom margin on mobile to account for bottom nav (not on stream pages)
            marginBottom: !isStreamPage && isMobile ? '3rem' : undefined,
          },
        }}
      />
    </>
  )
}
