"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { GlobalHeader } from "./global-header"
import { GlobalSidebar } from "./global-sidebar"
import { cn } from "@/lib/utils"

interface GlobalLayoutProps {
  children: React.ReactNode
}

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarPinned, setIsSidebarPinned] = useState(true) // Start with sidebar pinned on desktop
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      
      // On mobile, sidebar is always unpinned and overlay
      if (mobile) {
        setIsSidebarPinned(false)
        setIsSidebarOpen(false)
      } else {
        // On desktop, start with sidebar pinned and open
        setIsSidebarPinned(true)
        setIsSidebarOpen(true)
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
    "pt-12 min-h-screen transition-all duration-300 ease-in-out",
    {
      // Desktop pinned state - sidebar takes up space
      "ml-64": isSidebarPinned && !isMobile,
      // Desktop unpinned or mobile - no margin (sidebar is overlay)
      "ml-0": (!isSidebarPinned && !isMobile) || isMobile,
    }
  )

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
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

      <main className={pageAreaClasses}>
        <div className="md:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
