"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { Sidebar, Menu, Users, ChevronDown, Home, Wallet as WalletIcon, Coins, Maximize2, Minimize2, MessageCircle, LogIn, UserPlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { AuthDialog } from "@/components/auth-dialog"
import { useAuth } from "@/components/auth-provider"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Community } from "@/types"
import { CreateCommunityDialog } from "@/components/create-community-dialog"
import { CommunityLogo } from "@/components/community-logo"
import { PlatformLogo } from "@/components/platform-logo"
import { useUnreadMessagesCount } from "@/hooks/use-unread-messages-count"
import { Badge } from "@/components/ui/badge"

interface GlobalHeaderProps {
  onMenuClick: () => void
  isSidebarOpen: boolean
  isMobile?: boolean
  fullscreenTargetRef?: React.RefObject<HTMLDivElement | null>
  onOnlineUsersSidebarToggle?: () => void
  isOnlineUsersSidebarOpen?: boolean
}

export function GlobalHeader({ onMenuClick, isSidebarOpen, isMobile = false, fullscreenTargetRef, onOnlineUsersSidebarToggle, isOnlineUsersSidebarOpen = false }: GlobalHeaderProps) {
  const { user, userProfile, walletBalance, walletEarningsBalance, userValuePerPoint, signOut, isLoading, refreshProfile } = useAuth()
  const pathname = usePathname()
  const { unreadCount } = useUnreadMessagesCount(user?.id ?? null)
  
  // Debug: Log unread count changes
  React.useEffect(() => {
    console.log("[GlobalHeader] Unread count changed:", unreadCount)
  }, [unreadCount])
  const [authDialogOpen, setAuthDialogOpen] = React.useState(false)
  const [authDialogTab, setAuthDialogTab] = React.useState<"signin" | "signup">("signin")
  const [createOpen, setCreateOpen] = React.useState(false)
  const [userCommunities, setUserCommunities] = React.useState<Community[]>([])
  const [allCommunities, setAllCommunities] = React.useState<Community[]>([])
  const [communitiesLoading, setCommunitiesLoading] = React.useState(false)
  const [allCommunitiesLoading, setAllCommunitiesLoading] = React.useState(false)
  const [isRetryingProfile, setIsRetryingProfile] = React.useState(false)
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const earningsDollarValue = React.useMemo(() => {
    if (walletEarningsBalance === null || userValuePerPoint === null) {
      return null
    }
    const numericBalance = Number(walletEarningsBalance)
    if (!Number.isFinite(numericBalance)) {
      return null
    }
    const value = numericBalance * userValuePerPoint
    return Number.isFinite(value) ? value : null
  }, [walletEarningsBalance, userValuePerPoint])
  const earningsDisplay = React.useMemo(() => {
    if (earningsDollarValue === null) {
      return "$0.00 TTD"
    }
    const formatted = earningsDollarValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return `$${formatted} TTD`
  }, [earningsDollarValue])
  
  // Memoize user initials to prevent unnecessary re-renders
  const userInitials = React.useMemo(() => {
    if (!userProfile) return "U"
    const firstInitial = userProfile.first_name?.[0] || ""
    const lastInitial = userProfile.last_name?.[0] || ""
    return (firstInitial + lastInitial).toUpperCase() || "U"
  }, [userProfile?.first_name, userProfile?.last_name])

  // Handle profile retry
  const handleRetryProfile = React.useCallback(async () => {
    setIsRetryingProfile(true)
    try {
      await refreshProfile()
    } finally {
      setIsRetryingProfile(false)
    }
  }, [refreshProfile])

  const currentCommunitySlug = React.useMemo(() => {
    if (!pathname) return null
    const segments = pathname.split("/").filter(Boolean)
    if (segments.length === 0) return null
    return segments[0] || null
  }, [pathname])

  type MinimalCommunity = Pick<Community, "id" | "name" | "slug" | "logo_url" | "is_active">

  const [activeCommunity, setActiveCommunity] = React.useState<MinimalCommunity | null>(null)

  React.useEffect(() => {
    if (!currentCommunitySlug) {
      setActiveCommunity(null)
      return
    }

    // Check user communities first if signed in
    if (user) {
      const existing = userCommunities.find((community) => community.slug === currentCommunitySlug)
      if (existing) {
        setActiveCommunity(existing)
        return
      }
    } else {
      // Check all communities if signed out
      const existing = allCommunities.find((community) => community.slug === currentCommunitySlug)
      if (existing) {
        setActiveCommunity(existing)
        return
      }
    }

    let isCancelled = false
    setActiveCommunity(null)

    const fetchCommunity = async () => {
      try {
        const response = await fetch(`/api/community-status?slug=${encodeURIComponent(currentCommunitySlug)}`)
        if (!response.ok) {
          if (!isCancelled) {
            setActiveCommunity(null)
          }
          return
        }
        const data = await response.json()
        if (!isCancelled && data?.community) {
          setActiveCommunity(data.community)
        } else if (!isCancelled) {
          setActiveCommunity(null)
        }
      } catch (error) {
        console.error("Error fetching current community info:", error)
        if (!isCancelled) {
          setActiveCommunity(null)
        }
      }
    }

    fetchCommunity()

    return () => {
      isCancelled = true
    }
  }, [currentCommunitySlug, userCommunities, allCommunities, user])

  // Fetch user's communities
  React.useEffect(() => {
    if (user && userProfile) {
      fetchUserCommunities()
    } else {
      setUserCommunities([])
    }
  }, [user, userProfile])

  // Fetch all active communities when signed out
  React.useEffect(() => {
    if (!user) {
      // Wait a bit to ensure Supabase client is fully ready
      const timer = setTimeout(() => {
        fetchAllCommunities()
      }, 100)
      return () => clearTimeout(timer)
    } else {
      setAllCommunities([])
    }
  }, [user])

  const fetchUserCommunities = async () => {
    if (!user) return
    
    setCommunitiesLoading(true)
    try {
      const { data, error } = await supabase
        .from('community_members')
        .select(`
          community_id,
          communities (
            id,
            name,
            slug,
            description,
            is_active,
            logo_url
          )
        `)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error fetching user communities:', error)
        return
      }

      // Transform the data to extract communities
      const communities = data
        ?.map((item: any) => item.communities)
        .filter(Boolean) || []
      
      setUserCommunities(communities)
    } catch (error) {
      console.error('Error fetching user communities:', error)
    } finally {
      setCommunitiesLoading(false)
    }
  }

  const fetchAllCommunities = async () => {
    setAllCommunitiesLoading(true)
    try {
      // Active communities are public (RLS allows anonymous access)
      const { data, error } = await supabase
        .from('communities')
        .select('id, name, slug, description, is_active, logo_url, owner_id, created_at, updated_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50) // Limit to 50 most recent communities

      if (error) {
        // Only log meaningful errors (not 401/unauthorized, which shouldn't happen for public data)
        // Also ignore "no rows returned" errors
        const isUnauthorized = (error as any).status === 401 || (error as any).status === 403
        const isNotFound = error.code === 'PGRST301' || error.message?.includes('No rows')
        if (!isUnauthorized && !isNotFound) {
          console.error('Error fetching all communities:', error)
        }
        // Set empty array on error to prevent UI issues
        setAllCommunities([])
        return
      }

      setAllCommunities((data || []) as Community[])
    } catch (error) {
      // Silently fail - communities list is not critical for app functionality
      // Set empty array to prevent UI issues
      setAllCommunities([])
    } finally {
      setAllCommunitiesLoading(false)
    }
  }

  const handleSignInClick = () => {
    setAuthDialogTab("signin")
    setAuthDialogOpen(true)
  }

  const handleSignUpClick = () => {
    setAuthDialogTab("signup")
    setAuthDialogOpen(true)
  }

  const updateFullscreenState = React.useCallback(() => {
    if (typeof document === "undefined") return
    const doc = document as any
    const fullscreenElement =
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement

    setIsFullscreen(Boolean(fullscreenElement))
  }, [])

  React.useEffect(() => {
    if (typeof document === "undefined") return

    const handler = () => updateFullscreenState()
    const vendorEvents = ["webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"] as const

    document.addEventListener("fullscreenchange", handler)
    vendorEvents.forEach((event) => document.addEventListener(event as any, handler))

    updateFullscreenState()

    return () => {
      document.removeEventListener("fullscreenchange", handler)
      vendorEvents.forEach((event) => document.removeEventListener(event as any, handler))
    }
  }, [updateFullscreenState])

  const toggleFullscreen = React.useCallback(async () => {
    if (typeof document === "undefined") return
    const element = (fullscreenTargetRef?.current ?? document.documentElement) as any
    const doc = document as any

    const fullscreenElement =
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement

    try {
      if (!fullscreenElement) {
        const requestWithOptions = async () => {
          if (!element.requestFullscreen) return false

          if (isMobile) {
            try {
              // Use "auto" to keep navigation UI visible (notch area) on mobile
              // This allows the background to stretch while content respects safe areas
              await element.requestFullscreen({ navigationUI: "auto" })
              return true
            } catch (err) {
              // Fallback to default request if options unsupported
              try {
                await element.requestFullscreen()
                return true
              } catch (innerErr) {
                console.warn("Fullscreen request failed:", innerErr)
                return false
              }
            }
          }

          await element.requestFullscreen()
          return true
        }

        let didRequest = await requestWithOptions()

        if (!didRequest) {
          try {
            if (element.webkitRequestFullscreen) {
              element.webkitRequestFullscreen()
              didRequest = true
            } else if (element.mozRequestFullScreen) {
              element.mozRequestFullScreen()
              didRequest = true
            } else if (element.msRequestFullscreen) {
              element.msRequestFullscreen()
              didRequest = true
            }
          } catch (fallbackError) {
            console.warn("Vendor fullscreen request failed:", fallbackError)
          }
        }

        if (!didRequest) {
          throw new Error("Fullscreen API not supported")
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen()
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen()
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen()
        } else {
          throw new Error("Fullscreen API not supported")
        }
      }
    } catch (error) {
      console.error("Error toggling fullscreen:", error)
      toast.error("Unable to toggle fullscreen")
    }
  }, [fullscreenTargetRef, isMobile])

  return (
    <>
    <header 
      className={cn(
        "fixed z-[150000] h-12 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md",
        // In fullscreen mode on mobile: rounded on all edges, border all around, spaced from edges
        isFullscreen && isMobile 
          ? "rounded-lg border border-white/20 left-2 right-2"
          : "left-0 right-0 rounded-b-lg border-b border-white/20"
      )}
      style={{
        // In fullscreen mode on mobile, push header down to respect notch area + 8px spacing
        top: isFullscreen && isMobile ? "calc(env(safe-area-inset-top, 0) + 8px)" : "0",
      }}
    >
      <div className="h-full px-1 flex items-center justify-between">
        {/* Left side - Menu Button (desktop only) and Logo */}
        <div className="flex items-center gap-2">
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white/80 touch-feedback"
              aria-label="Toggle sidebar"
            >
              <Sidebar className="h-4 w-4" />
            </Button>
          )}
          
          {/* Logo / Communities Dropdown */}
          <DropdownMenu onOpenChange={(open) => {
            // Remove focus state on mobile when dropdown closes to prevent persistent border
            if (!open && isMobile && typeof document !== "undefined") {
              // Blur any focused element after a short delay to ensure dropdown closes first
              setTimeout(() => {
                const activeElement = document.activeElement as HTMLElement
                if (activeElement && activeElement.blur) {
                  activeElement.blur()
                }
              }, 100)
            }
          }}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-auto p-1 gap-2 hover:bg-white/20 data-[state=open]:bg-white/20 touch-feedback cursor-pointer",
                  "focus-visible:ring-0 focus-visible:ring-offset-0",
                  "focus:outline-none focus-visible:outline-none",
                  "active:bg-white/20",
                  // Remove all focus styles on mobile to prevent persistent border
                  isMobile && "!ring-0 !ring-offset-0 focus:!ring-0 focus-visible:!ring-0"
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {activeCommunity ? (
                    <CommunityLogo
                      name={activeCommunity.name}
                      logoUrl={activeCommunity.logo_url}
                      size="sm"
                      className="border-4 border-white/20 flex-shrink-0"
                    />
                  ) : (
                    <PlatformLogo size="xs" />
                  )}
                  <span className="font-semibold text-white text-sm truncate max-w-[140px] sm:max-w-none min-w-0">
                    {activeCommunity?.name ?? "Success Family"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-white flex-shrink-0" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 z-[170000]" align="start" forceMount>
              <DropdownMenuLabel>
                {user 
                  ? (communitiesLoading 
                      ? "Your Communities" 
                      : userCommunities.length > 0 
                        ? "Your Communities"
                        : "Communities")
                  : (allCommunitiesLoading 
                      ? "Communities" 
                      : "Communities")
                }
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {user ? (
                // Signed in - show user's communities
                communitiesLoading ? (
                  <DropdownMenuItem disabled>
                    <span className="text-sm text-muted-foreground">Loading...</span>
                  </DropdownMenuItem>
                ) : userCommunities.length === 0 ? (
                  <>
                    <DropdownMenuItem disabled>
                      <span className="text-sm text-muted-foreground">No communities yet</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/communities" className="cursor-pointer">
                        <Home className="mr-2 h-4 w-4" />
                        <span>Browse All Communities</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                      <Users className="mr-2 h-4 w-4" />
                      <span>Create Community</span>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    {userCommunities.map((community) => (
                      <DropdownMenuItem key={community.id} asChild>
                        <Link 
                          href={`/${community.slug}`} 
                          className={cn(
                            "cursor-pointer rounded-md",
                            activeCommunity?.id === community.id && "bg-white/10 text-white"
                          )}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <CommunityLogo
                              name={community.name}
                              logoUrl={community.logo_url}
                              size="sm"
                              className="border-4 border-white/20 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{community.name}</p>
                              {!community.is_active && (
                                <p className="text-xs text-muted-foreground">Inactive</p>
                              )}
                            </div>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/communities" className="cursor-pointer">
                        <Home className="mr-2 h-4 w-4" />
                        <span>Browse All Communities</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                      <Users className="mr-2 h-4 w-4" />
                      <span>Create Community</span>
                    </DropdownMenuItem>
                  </>
                )
              ) : (
                // Signed out - show all active communities
                allCommunitiesLoading ? (
                  <DropdownMenuItem disabled>
                    <span className="text-sm text-muted-foreground">Loading...</span>
                  </DropdownMenuItem>
                ) : allCommunities.length === 0 ? (
                  <>
                    <DropdownMenuItem disabled>
                      <span className="text-sm text-muted-foreground">No communities available</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/communities" className="cursor-pointer">
                        <Home className="mr-2 h-4 w-4" />
                        <span>Browse All Communities</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => (setAuthDialogTab("signin"), setAuthDialogOpen(true))}>
                      <Users className="mr-2 h-4 w-4" />
                      <span>Create Community</span>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    {allCommunities.map((community) => (
                      <DropdownMenuItem key={community.id} asChild>
                        <Link 
                          href={`/${community.slug}`} 
                          className={cn(
                            "cursor-pointer rounded-md",
                            activeCommunity?.id === community.id && "bg-white/10 text-white"
                          )}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <CommunityLogo
                              name={community.name}
                              logoUrl={community.logo_url}
                              size="sm"
                              className="border-4 border-white/20 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{community.name}</p>
                            </div>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/communities" className="cursor-pointer">
                        <Home className="mr-2 h-4 w-4" />
                        <span>Browse All Communities</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => (setAuthDialogTab("signin"), setAuthDialogOpen(true))}>
                      <Users className="mr-2 h-4 w-4" />
                      <span>Create Community</span>
                    </DropdownMenuItem>
                  </>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right side - Menu Button (mobile only) and Auth Buttons */}
        <div className="flex items-center gap-2">
          {user && !userProfile && !isRetryingProfile ? (
            // User is authenticated but profile failed to load - show retry option
            <Button
              variant="ghost"
              size="sm"
              className="text-xs hover:bg-white/20 touch-feedback"
              onClick={handleRetryProfile}
            >
              Retry Loading Profile
            </Button>
          ) : !user ? (
            <>
              {/* Desktop auth buttons only - hide on mobile */}
              <Button
                variant="ghost"
                className="hidden md:inline-flex h-10 px-3 bg-white/10 hover:bg-white/20 text-white/80 touch-feedback"
                onClick={handleSignInClick}
              >
                <LogIn className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                <span className="text-xs font-semibold whitespace-nowrap">
                  Sign In
                </span>
              </Button>
              <Button
                variant="ghost"
                className="hidden md:inline-flex h-10 px-3 bg-white/10 hover:bg-white/20 text-white/80 touch-feedback"
                onClick={handleSignUpClick}
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                <span className="text-xs font-semibold whitespace-nowrap">
                  Sign Up
                </span>
              </Button>
            </>
          ) : user ? (
            <>
              <div className="hidden md:flex items-center gap-2">
                <Link href="/wallet" className="cursor-pointer">
                  <Button variant="ghost" className="h-8 px-2 bg-white/10 hover:bg-white/20 text-white/80 touch-feedback">
                    <WalletIcon className="h-4 w-4 mr-1" />
                    <span className="text-sm">{walletBalance === null ? '0 pts' : `${Math.trunc(walletBalance)} pts`}</span>
                  </Button>
                </Link>
                <Link href="/wallet?tab=payouts" className="cursor-pointer">
                  <Button variant="ghost" className="h-8 px-3 bg-white/10 hover:bg-white/20 text-white/80 touch-feedback">
                    <Coins className="h-4 w-4 mr-1" />
                    <span className="text-sm">{earningsDisplay}</span>
                  </Button>
                </Link>
              </div>
            </>
          ) : null}

          {/* Fullscreen button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white/80 touch-feedback"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          
          {/* Online users sidebar toggle button - all pages, mobile and desktop */}
          {onOnlineUsersSidebarToggle && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOnlineUsersSidebarToggle}
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white/80 touch-feedback"
              aria-label={isOnlineUsersSidebarOpen ? "Close online users" : "Open online users"}
            >
              {isMobile && isOnlineUsersSidebarOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Users className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Messages button - shown when user is logged in, desktop only */}
          {user && (
            <Link href="/messages" className="cursor-pointer hidden md:flex relative">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white/80 touch-feedback">
                <MessageCircle className="h-4 w-4" />
              </Button>
              {unreadCount > 0 && (
                <Badge 
                  key={`unread-${unreadCount}`}
                  className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center bg-white/90 text-black border-0 text-[9px] font-semibold shadow-md"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </Link>
          )}

          {/* Profile button - shown when user is logged in, farthest right, desktop only */}
          {user && (
            <Link href={`/profile/${userProfile?.username || ''}`} className="cursor-pointer flex items-center hidden md:flex">
              <Button variant="ghost" className="h-10 w-10 rounded-full p-0 avatar-feedback cursor-pointer flex items-center justify-center">
                <Avatar 
                  className="h-8 w-8 border-2 border-white/20" 
                  userId={user?.id}
                  loading={isLoading || !userProfile}
                >
                  {!isLoading && userProfile && (
                    <>
                      <AvatarImage src={userProfile?.profile_picture || undefined} alt={userProfile?.username || user.email || "User"} />
                      <AvatarFallback className="text-xs">
                        {userInitials}
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>
              </Button>
            </Link>
          )}
          
          {/* Mobile menu button - far right on mobile only */}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white/80 touch-feedback"
              aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {isSidebarOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </header>

    <AuthDialog
      open={authDialogOpen}
      onOpenChange={setAuthDialogOpen}
      defaultTab={authDialogTab}
    />
    <CreateCommunityDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}
