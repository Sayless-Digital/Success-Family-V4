"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { X, Home, Users, Settings, BarChart3, Shield, Database, FileText, Building2, Package, LogOut, CreditCard, User, HardDrive, Coins, Download, Gift, TrendingUp, Wallet, Mail, HelpCircle, Briefcase, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface GlobalSidebarProps {
  isOpen: boolean
  onClose: () => void
  isPinned: boolean
  onTogglePin: () => void
  onHoverChange?: (isHovered: boolean) => void
  isMobile: boolean
  isAdminMode?: boolean
  isFullscreen?: boolean
}

const baseNavigationItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Users, label: "Communities", href: "/communities" },
  { icon: HelpCircle, label: "FAQ", href: "/faq" },
]

// User menu items (shown when authenticated)
const userMenuItems = [
  { icon: User, label: "Profile", href: "#", isDynamic: true }, // Dynamic - will be set based on username
  { icon: Gift, label: "Referrals", href: "/referrals" },
  { icon: Settings, label: "Account", href: "/account" },
  { icon: HardDrive, label: "Storage", href: "/storage" },
]

// Community navigation removed - now using tabs at top of community pages

const adminNavigationItems = [
  { icon: BarChart3, label: "Dashboard", href: "/admin" },
  { icon: Building2, label: "Bank Accounts", href: "/admin/bank-accounts" },
  { icon: TrendingUp, label: "Revenue", href: "/admin/revenue" },
  { icon: Wallet, label: "Withdrawals", href: "/admin/withdrawals" },
  { icon: Users, label: "Manage Users", href: "/admin/users" },
  { icon: Briefcase, label: "CRM", href: "/admin/crm" },
  { icon: Shield, label: "Roles & Permissions", href: "/admin/roles" },
  { icon: Database, label: "Database", href: "/admin/database" },
  { icon: FileText, label: "Reports", href: "/admin/reports" },
  { icon: CreditCard, label: "Transactions", href: "/admin/transactions" },
  { icon: Coins, label: "Payouts", href: "/admin/payouts" },
  { icon: CreditCard, label: "Payment Verification", href: "/admin/payments" },
  { icon: Mail, label: "Test Emails", href: "/admin/emails" },
  { icon: GraduationCap, label: "Webinar Signups", href: "/admin/webinar-signups" },
  { icon: Settings, label: "Platform Settings", href: "/admin/settings" },
]

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

export function GlobalSidebar({ isOpen, onClose, isPinned, onTogglePin, onHoverChange, isMobile, isFullscreen = false }: GlobalSidebarProps) {
  const [isHoverTriggerActive, setIsHoverTriggerActive] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isAppInstalled, setIsAppInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [currentUserCount, setCurrentUserCount] = useState<number>(0)
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

  useEffect(() => {
    if (typeof window === "undefined") return

    const checkInstalled = () => {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      const isIOSStandalone = (window.navigator as unknown as { standalone?: boolean })?.standalone
      if (isStandalone || isIOSStandalone) {
        setIsAppInstalled(true)
        setInstallPrompt(null)
      }
    }

    const detectIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase()
      const isiOSDevice = /iphone|ipad|ipod/.test(userAgent)
      const isInStandaloneMode =
        (window.navigator as unknown as { standalone?: boolean })?.standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches

      if (isiOSDevice && !isInStandaloneMode) {
        setIsIOS(true)
      }
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      const promptEvent = event as BeforeInstallPromptEvent
      setInstallPrompt(promptEvent)
    }

    const handleAppInstalled = () => {
      setIsAppInstalled(true)
      setInstallPrompt(null)
      toast.success("App installed successfully!")
    }

    checkInstalled()
    detectIOS()
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)
    window.addEventListener("visibilitychange", checkInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
      window.removeEventListener("visibilitychange", checkInstalled)
    }
  }, [])

  // Fetch user count
  useEffect(() => {
    const fetchUserCount = async () => {
      try {
        const { count } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
        setCurrentUserCount(count ?? 0)
      } catch (error) {
        console.error('Error fetching user count:', error)
      }
    }

    fetchUserCount()
  }, [])

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt()
      try {
        const choice = await installPrompt.userChoice
        if (choice?.outcome === "accepted") {
          setInstallPrompt(null)
        }
      } catch (error) {
        console.error("[PWA] Install prompt error", error)
      }
    } else if (isIOS) {
      toast.info("Install Success Family", {
        description: "Tap the share icon, then choose \"Add to Home Screen\".",
      })
    }

    if (isMobile) onClose()
  }

  const showInstallButton = !isAppInstalled && (Boolean(installPrompt) || isIOS)

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
    "fixed w-64 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md transition-all duration-300 ease-in-out z-[9000] rounded-lg border border-white/20 overflow-visible",
    {
      // Mobile: slide from right
      // Header is h-12 (3rem) fixed at top, bottom nav is h-12 (3rem) fixed at bottom
      // Sidebar starts at top-14 (3.5rem from top = 3rem header + 0.5rem gap)
      // Height: Available space from top-14 to bottom, minus bottom nav and gap
      "top-14 right-2 left-auto": isMobile && !isFullscreen,
      "h-[calc(100dvh-3.5rem-3rem-0.5rem)]": isMobile && !isFullscreen, // 100dvh - sidebar top (3.5rem) - bottom nav (3rem) - bottom gap (0.5rem)
      "translate-x-0": shouldShowSidebar,
      "translate-x-full": isMobile && !shouldShowSidebar,
      // Desktop: slide from left
      "top-14 left-2": !isMobile, // 3rem header + 0.5rem gap = 3.5rem
      "h-[calc(100dvh-3.5rem-0.5rem)]": !isMobile, // 100dvh - sidebar top (3.5rem) - bottom spacing (0.5rem)
      "-translate-x-full": !isMobile && !shouldShowSidebar,
      // Hide completely when not showing
      "opacity-0 pointer-events-none": !shouldShowSidebar,
    }
  )

  // In fullscreen mode on mobile, adjust positioning to account for header position
  const fullscreenStyle = isFullscreen && isMobile ? {
    top: "calc(env(safe-area-inset-top, 0) + 8px + 3rem + 0.5rem)",
    height: "calc(100vh - env(safe-area-inset-top, 0) - 8px - 3rem - 0.5rem - 3rem - 0.5rem)", // 100vh - top - header - gap - bottom nav - gap
  } : {}

  return (
    <>
      {/* Desktop hover trigger area when unpinned */}
      {!isMobile && !isPinned && (
        <div
          className="fixed top-14 left-0 w-8 h-[calc(100dvh-3.5rem)] z-30"
          onMouseEnter={handleHoverEnter}
          onMouseLeave={handleHoverLeave}
        />
      )}

      {/* Sidebar */}
      <aside
        className={sidebarClasses}
        style={fullscreenStyle}
        onMouseLeave={() => {
          // Close sidebar when mouse leaves if unpinned
          if (!isPinned && !isMobile) {
            onClose()
          }
        }}
      >
        <div className="h-full flex flex-col relative z-10">
          {/* User Count Display */}
          <div className="px-4 pt-4 pb-2">
            <div className="bg-white/10 backdrop-blur-2xl border-0 rounded-lg p-2">
              <div className="flex items-center justify-center gap-2">
                <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-white/70" />
                </div>
                <span className="text-sm font-semibold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
                  {currentUserCount.toLocaleString()}
                </span>
                <span className="text-sm font-medium text-white">Users Signed up</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 pt-2 overflow-y-auto">
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

                  {showInstallButton && (
                    <li>
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 h-10 text-white hover:bg-white/20 hover:backdrop-blur-md touch-feedback"
                        onClick={handleInstallClick}
                      >
                        <Download className="h-4 w-4 text-white/80" />
                        <span>Install App</span>
                      </Button>
                    </li>
                  )}
                  
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

                  {showInstallButton && (
                    <li>
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 h-10 text-white hover:bg-white/20 hover:backdrop-blur-md touch-feedback"
                        onClick={handleInstallClick}
                      >
                        <Download className="h-4 w-4 text-white/80" />
                        <span>Install App</span>
                      </Button>
                    </li>
                  )}
                  
                  {/* Admin-only Email indicator - orange to show it's not visible to others */}
                  {isAdmin && (
                    <>
                      <Separator className="my-2 bg-white/10" />
                      <li>
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-3 h-10 text-orange-500 hover:bg-orange-500/20 hover:backdrop-blur-md touch-feedback"
                            asChild
                          >
                            <Link href="/emails" onClick={() => isMobile && onClose()} prefetch={true}>
                              <Mail className="h-4 w-4" />
                              <span>Email (Admin Only)</span>
                            </Link>
                        </Button>
                      </li>
                    </>
                  )}
                  
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
