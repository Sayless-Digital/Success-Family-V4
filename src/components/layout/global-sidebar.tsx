"use client"

import { useState, useEffect } from "react"
import { X, Home, Users, Settings, BarChart3, MessageSquare, Calendar, Shield, Database, FileText, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface GlobalSidebarProps {
  isOpen: boolean
  onClose: () => void
  isPinned: boolean
  onTogglePin: () => void
  onHoverChange?: (isHovered: boolean) => void
  isMobile: boolean
  isAdminMode?: boolean
}

const navigationItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Users, label: "Community", href: "/community" },
  { icon: MessageSquare, label: "Messages", href: "/messages" },
  { icon: Calendar, label: "Events", href: "/events" },
  { icon: BarChart3, label: "Analytics", href: "/analytics" },
  { icon: Settings, label: "Settings", href: "/settings" },
]

const adminNavigationItems = [
  { icon: BarChart3, label: "Dashboard", href: "/admin" },
  { icon: Users, label: "Manage Users", href: "/admin/users" },
  { icon: Shield, label: "Roles & Permissions", href: "/admin/roles" },
  { icon: Database, label: "Database", href: "/admin/database" },
  { icon: FileText, label: "Reports", href: "/admin/reports" },
  { icon: Settings, label: "Platform Settings", href: "/admin/settings" },
]

export function GlobalSidebar({ isOpen, onClose, isPinned, onTogglePin, onHoverChange, isMobile }: GlobalSidebarProps) {
  const [isHoverTriggerActive, setIsHoverTriggerActive] = useState(false)

  // Notify parent when hover trigger is activated (for auto-opening)
  const handleHoverEnter = () => {
    setIsHoverTriggerActive(true)
    onHoverChange?.(true)
  }

  const handleHoverLeave = () => {
    setIsHoverTriggerActive(false)
    onHoverChange?.(false)
  }

  // Determine if sidebar should be visible
  const shouldShowSidebar = isMobile ? isOpen : (isPinned || isOpen)

  const sidebarClasses = cn(
    "fixed top-14 left-2 h-[calc(100vh-4rem)] w-64 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md transition-all duration-300 ease-in-out z-40 rounded-lg",
    {
      // Mobile: slide from right with full rounding
      "right-2 left-auto": isMobile,
      "translate-x-0": isMobile && shouldShowSidebar,
      "translate-x-full": isMobile && !shouldShowSidebar,
      // Desktop: slide from left with full rounding
      "left-2": !isMobile,
      "translate-x-0": !isMobile && shouldShowSidebar,
      "-translate-x-full": !isMobile && !shouldShowSidebar,
      // Hide completely when not showing
      "opacity-0 pointer-events-none": !shouldShowSidebar,
    }
  )

  return (
    <>
      {/* Desktop hover trigger area when unpinned */}
      {!isMobile && !isPinned && (
        <div
          className="fixed top-14 left-0 w-8 h-[calc(100vh-4rem)] z-30"
          onMouseEnter={handleHoverEnter}
          onMouseLeave={handleHoverLeave}
        />
      )}

      {/* Sidebar */}
      <aside
        className={sidebarClasses}
        onMouseLeave={() => {
          // Close sidebar when mouse leaves if unpinned
          if (!isPinned && !isMobile) {
            onClose()
          }
        }}
      >
        <div className="h-full flex flex-col">
          {/* Navigation */}
          <nav className="flex-1 p-4 pt-6">
            <ul className="space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-10 text-white hover:bg-white/20 hover:backdrop-blur-md"
                      asChild
                    >
                      <a href={item.href}>
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </a>
                    </Button>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Footer - Removed for cleaner look */}
        </div>
      </aside>
    </>
  )
}
