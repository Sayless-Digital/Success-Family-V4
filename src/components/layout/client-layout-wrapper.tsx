"use client"

import { useState, useEffect } from "react"
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
  
  const isStreamPage = pathname?.includes('/stream')

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
    <div className="h-dvh bg-background overflow-x-hidden flex flex-col relative">
      {/* Silk Background - Optimized with dynamic import */}
      <div className="fixed inset-0 z-0 overflow-hidden w-full h-full">
        <div className="w-full h-full">
          <Silk
            speed={isStreamPage ? 0 : (isMobile ? 0.5 : 1.0)}
            scale={1}
            color={isMobile ? "#0d041f" : "#0a0318"}
            noiseIntensity={isMobile ? 0.5 : 1}
            rotation={0}
          />
        </div>
      </div>
      
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