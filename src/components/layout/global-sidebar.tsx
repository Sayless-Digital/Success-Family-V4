"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { X, Home, Users, Settings, BarChart3, Shield, Database, FileText, Building2, Package, LogOut, CreditCard, User, HardDrive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { toast } from "sonner"

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

// User menu items (shown when authenticated)
const userMenuItems = [
  { icon: User, label: "Profile", href: "#", isDynamic: true }, // Dynamic - will be set based on username
  { icon: Settings, label: "Account", href: "/account" },
  { icon: HardDrive, label: "Storage", href: "/storage" },
]

// Community navigation removed - now using tabs at top of community pages

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
  const { userProfile, isLoading, user, signOut } = useAuth()
  const pathname = usePathname()
  
  // Check if user is admin and on admin route
  const isAdmin = React.useMemo(() => {
    return userProfile?.role === 'admin'
  }, [userProfile?.role])
  
  const isOnAdminRoute = React.useMemo(() => {
    return pathname.startsWith('/admin')
  }, [pathname])
  
  // Show admin menu only if user is admin AND on admin route
  const showAdminMenu = isAdmin && isOnAdminRoute

  const handleSignOut = async () => {
    await signOut()
    toast.success("Signed out successfully!")
    if (isMobile) onClose()
  }

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
    "fixed top-14 left-2 w-64 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md transition-all duration-300 ease-in-out z-[9999] rounded-lg",
    {
      // Mobile: slide from right with full rounding, account for bottom nav (48px)
      "right-2 left-auto": isMobile,
      "h-[calc(100dvh-4rem-3rem)]": isMobile, // Header (48px) + Bottom Nav (48px) = 96px = 6rem, but using 4rem+3rem=7rem for calc
      "translate-x-0": shouldShowSidebar,
      "translate-x-full": isMobile && !shouldShowSidebar,
      // Desktop: slide from left with full rounding
      "left-2": !isMobile,
      "h-[calc(100dvh-4rem)]": !isMobile,
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
          className="fixed top-14 left-0 w-8 h-[calc(100dvh-4rem)] z-30"
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
                      className="w-full justify-start gap-3 h-10 text-white hover:bg-white/20 hover:backdrop-blur-md touch-feedback"
                      asChild
                    >
                      <Link href="/" onClick={() => isMobile && onClose()} prefetch={true}>
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
                          className="w-full justify-start gap-3 h-10 text-white hover:bg-white/20 hover:backdrop-blur-md touch-feedback"
                          asChild
                        >
                          <Link href={item.href} onClick={() => isMobile && onClose()} prefetch={true}>
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
                <>
                  {baseNavigationItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <li key={item.href}>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-3 h-10 text-white hover:bg-white/20 hover:backdrop-blur-md touch-feedback"
                          asChild
                        >
                          <Link href={item.href} onClick={() => isMobile && onClose()} prefetch={true}>
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </Button>
                      </li>
                    )
                  })}
                  
                  {/* User menu items - shown when authenticated */}
                  {userProfile && user && (
                    <>
                      <Separator className="my-2 bg-white/10" />
                      {userMenuItems.map((item) => {
                        const Icon = item.icon
                        // Build dynamic href for profile
                        const href = item.isDynamic && userProfile.username
                          ? `/profile/${userProfile.username}`
                          : item.href
                        return (
                          <li key={item.href}>
                            <Button
                              variant="ghost"
                              className="w-full justify-start gap-3 h-10 text-white hover:bg-white/20 hover:backdrop-blur-md touch-feedback"
                              asChild
                            >
                              <Link href={href} onClick={() => isMobile && onClose()} prefetch={true}>
                                <Icon className="h-4 w-4" />
                                <span>{item.label}</span>
                              </Link>
                            </Button>
                          </li>
                        )
                      })}
                      {isAdmin && (
                        <li>
                          <Button
                            variant="ghost"
                            className="w-full justify-start gap-3 h-10 text-white hover:bg-white/20 hover:backdrop-blur-md touch-feedback"
                            asChild
                          >
                            <Link href="/admin" onClick={() => isMobile && onClose()} prefetch={true}>
                              <Shield className="h-4 w-4" />
                              <span>Admin Dashboard</span>
                            </Link>
                          </Button>
                        </li>
                      )}
                      <Separator className="my-2 bg-white/10" />
                      <li>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-3 h-10 text-white hover:bg-white/20 hover:backdrop-blur-md touch-feedback"
                          onClick={handleSignOut}
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Sign Out</span>
                        </Button>
                      </li>
                    </>
                  )}
                </>
              )}
            </ul>
          </nav>

          {/* Footer - Removed for cleaner look */}
        </div>
      </aside>
    </>
  )
}
