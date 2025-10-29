"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { X, Home, Users, Settings, BarChart3, MessageSquare, Calendar, Shield, Database, FileText, ArrowLeft, Building2, Package, LogOut, UserCheck, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"

interface GlobalSidebarProps {
  isOpen: boolean
  onClose: () => void
  isPinned: boolean
  onTogglePin: () => void
  onHoverChange?: (isHovered: boolean) => void
  isMobile: boolean
  isAdminMode?: boolean
}

const baseNavigationItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Users, label: "Communities", href: "/communities" },
]

const communityNavigationItems = [
  { icon: Users, label: "Community Home", href: "#", isDynamic: true },
  { icon: UserCheck, label: "Members", href: "/members", isDynamic: true },
  { icon: Settings, label: "Settings", href: "/settings", isDynamic: true },
  { icon: MessageSquare, label: "Messages", href: "#", isDynamic: true },
  { icon: Calendar, label: "Events", href: "#", isDynamic: true },
  { icon: BarChart3, label: "Analytics", href: "#", isDynamic: true },
]

const adminNavigationItems = [
  { icon: BarChart3, label: "Dashboard", href: "/admin" },
  { icon: Building2, label: "Bank Accounts", href: "/admin/bank-accounts" },
  { icon: Users, label: "Manage Users", href: "/admin/users" },
  { icon: Shield, label: "Roles & Permissions", href: "/admin/roles" },
  { icon: Database, label: "Database", href: "/admin/database" },
  { icon: FileText, label: "Reports", href: "/admin/reports" },
  { icon: CreditCard, label: "Transactions", href: "/admin/transactions" },
  { icon: Settings, label: "Platform Settings", href: "/admin/settings" },
]

export function GlobalSidebar({ isOpen, onClose, isPinned, onTogglePin, onHoverChange, isMobile }: GlobalSidebarProps) {
  const [isHoverTriggerActive, setIsHoverTriggerActive] = useState(false)
  const [isCommunityOwner, setIsCommunityOwner] = useState(false)
  const [isCheckingOwner, setIsCheckingOwner] = useState(false)
  const { userProfile, isLoading, user } = useAuth()
  const pathname = usePathname()
  
  // Check if user is admin and on admin route
  const isAdmin = React.useMemo(() => {
    return userProfile?.role === 'admin'
  }, [userProfile?.role])
  
  const isOnAdminRoute = React.useMemo(() => {
    return pathname.startsWith('/admin')
  }, [pathname])
  
  // Check if on a community page (dynamic route like /[slug])
  const isOnCommunityRoute = React.useMemo(() => {
    // Match any route that's not admin, and is not /, /communities, /settings, /account, etc.
    const nonCommunityRoutes = ['/', '/communities', '/create-community', '/account', '/profile', '/admin']
    return !nonCommunityRoutes.some(route => pathname === route || pathname.startsWith(route + '/')) && 
           !pathname.startsWith('/admin')
  }, [pathname])
  
  // Extract community slug from pathname
  const communitySlug = React.useMemo(() => {
    if (isOnCommunityRoute) {
      const segments = pathname.split('/').filter(Boolean)
      return segments[0] // The first segment is the community slug
    }
    return null
  }, [pathname, isOnCommunityRoute])
  
  // Check if user is the owner of the current community
  React.useEffect(() => {
    const checkCommunityOwner = async () => {
      if (!user || !communitySlug) {
        setIsCommunityOwner(false)
        return
      }

      setIsCheckingOwner(true)
      try {
        const { data: community } = await supabase
          .from('communities')
          .select('owner_id')
          .eq('slug', communitySlug)
          .single()

        setIsCommunityOwner(community?.owner_id === user.id)
      } catch (error) {
        console.error('Error checking community owner:', error)
        setIsCommunityOwner(false)
      } finally {
        setIsCheckingOwner(false)
      }
    }

    checkCommunityOwner()
  }, [user, communitySlug])
  
  // Show admin menu only if user is admin AND on admin route
  const showAdminMenu = isAdmin && isOnAdminRoute
  
  // Show community menu only if on a community route
  const showCommunityMenu = isOnCommunityRoute && !!communitySlug
  

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
    "fixed top-14 left-2 h-[calc(100vh-4rem)] w-64 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md transition-all duration-300 ease-in-out z-[9999] rounded-lg",
    {
      // Mobile: slide from right with full rounding
      "right-2 left-auto": isMobile,
      "translate-x-0": shouldShowSidebar,
      "translate-x-full": isMobile && !shouldShowSidebar,
      // Desktop: slide from left with full rounding
      "left-2": !isMobile,
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
          <nav className="flex-1 p-4 pt-6 overflow-y-auto">
            <ul className="space-y-2">
              {showAdminMenu ? (
                // Admin users see only admin navigation with back to site button (only on admin routes)
                <>
                  {/* Back to Site Button */}
                  <li>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-10 text-white hover:bg-white/20 hover:backdrop-blur-md"
                      asChild
                    >
                      <Link href="/" onClick={() => isMobile && onClose()}>
                        <LogOut className="h-4 w-4" />
                        <span>Back to Site</span>
                      </Link>
                    </Button>
                  </li>
                  
                  {/* Admin navigation items */}
                  {adminNavigationItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <li key={item.href}>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-3 h-10 text-white hover:bg-white/20 hover:backdrop-blur-md"
                          asChild
                        >
                          <Link href={item.href} onClick={() => isMobile && onClose()}>
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </Button>
                      </li>
                    )
                  })}
                </>
              ) : showCommunityMenu ? (
                // Community context navigation
                <>
                  {/* Back to Communities Button */}
                  <li>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-10 text-white hover:bg-white/20 hover:backdrop-blur-md"
                      asChild
                    >
                      <Link href="/communities" onClick={() => isMobile && onClose()}>
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Communities</span>
                      </Link>
                    </Button>
                  </li>
                  
                  {/* Community navigation items */}
                  {communityNavigationItems
                    .filter((item) => {
                      // Only show owner-only items if user is the community owner
                      if ((item as any).ownerOnly) {
                        return isCommunityOwner
                      }
                      return true
                    })
                    .map((item) => {
                    const Icon = item.icon
                    // Build dynamic href with community slug
                    const href = item.isDynamic && communitySlug 
                      ? `/${communitySlug}${item.href === '#' ? '' : '/' + item.href}`
                      : item.href
                    
                    return (
                      <li key={item.label}>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-3 h-10 text-white hover:bg-white/20 hover:backdrop-blur-md"
                          asChild
                        >
                          <Link href={href} onClick={() => isMobile && onClose()}>
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </Button>
                      </li>
                    )
                  })}
                </>
              ) : (
                // Base navigation (homepage and other non-context pages)
                baseNavigationItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 h-10 text-white hover:bg-white/20 hover:backdrop-blur-md"
                        asChild
                      >
                        <Link href={item.href} onClick={() => isMobile && onClose()}>
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </Button>
                    </li>
                  )
                })
              )}
            </ul>
          </nav>

          {/* Footer - Removed for cleaner look */}
        </div>
      </aside>
    </>
  )
}
