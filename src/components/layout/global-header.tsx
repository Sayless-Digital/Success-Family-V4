"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Sidebar, Menu, Users, ChevronDown, Home, Wallet as WalletIcon, Coins, Maximize2, Minimize2, MessageCircle } from "lucide-react"
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

interface GlobalHeaderProps {
  onMenuClick: () => void
  isSidebarOpen: boolean
  isMobile?: boolean
  fullscreenTargetRef?: React.RefObject<HTMLDivElement | null>
}

export function GlobalHeader({ onMenuClick, isSidebarOpen, isMobile = false, fullscreenTargetRef }: GlobalHeaderProps) {
  const { user, userProfile, walletBalance, walletEarningsBalance, userValuePerPoint, signOut, isLoading, refreshProfile } = useAuth()
  const [authDialogOpen, setAuthDialogOpen] = React.useState(false)
  const [authDialogTab, setAuthDialogTab] = React.useState<"signin" | "signup">("signin")
  const [createOpen, setCreateOpen] = React.useState(false)
  const [userCommunities, setUserCommunities] = React.useState<Community[]>([])
  const [communitiesLoading, setCommunitiesLoading] = React.useState(false)
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
      return "—"
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

  // Fetch user's communities
  React.useEffect(() => {
    if (user && userProfile) {
      fetchUserCommunities()
    } else {
      setUserCommunities([])
    }
  }, [user, userProfile])

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
            is_active
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
              await element.requestFullscreen({ navigationUI: "show" })
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
    <header className="fixed top-0 left-0 right-0 z-[11000] h-12 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md rounded-b-lg border-b border-white/20">
      <div className="h-full px-1 flex items-center justify-between">
        {/* Left side - Menu Button (desktop only) and Logo */}
        <div className="flex items-center gap-2">
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="h-8 w-8 hover:bg-white/20 touch-feedback"
              aria-label="Toggle sidebar"
            >
              <Sidebar className="h-4 w-4" />
            </Button>
          )}
          
          {/* Logo / Communities Dropdown */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-auto p-1 gap-2 hover:bg-white/20 data-[state=open]:bg-white/20 touch-feedback cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm border-4 border-white/20 shadow-lg backdrop-blur-md">
                      SF
                    </div>
                    <span className="font-semibold text-white text-sm">
                      Success Family
                    </span>
                    <ChevronDown className="h-4 w-4 text-white" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 z-[12000]" align="start" forceMount>
                <DropdownMenuLabel>
                  {communitiesLoading 
                    ? "Your Communities" 
                    : userCommunities.length > 0 
                      ? "Your Communities"
                      : "Communities"
                  }
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {communitiesLoading ? (
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
                    <DropdownMenuItem onClick={() => (user ? setCreateOpen(true) : (setAuthDialogTab("signin"), setAuthDialogOpen(true)))}>
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
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2 w-full">
                            <div className="h-8 w-8 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm border-4 border-white/20 shadow-lg backdrop-blur-md flex-shrink-0">
                              {community.name[0]}
                            </div>
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
                    <DropdownMenuItem onClick={() => (user ? setCreateOpen(true) : (setAuthDialogTab("signin"), setAuthDialogOpen(true)))}>
                      <Users className="mr-2 h-4 w-4" />
                      <span>Create Community</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm border-4 border-white/20 shadow-lg backdrop-blur-md">
                SF
              </div>
              <span className="font-semibold text-white hidden sm:block">
                Success Family
              </span>
            </Link>
          )}
        </div>

        {/* Right side - Menu Button (mobile only) and Auth Buttons */}
        <div className="flex items-center gap-2">
          {isLoading ? (
            // Show loading state to prevent flash - but with timeout protection
            <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
          ) : user && !userProfile && !isRetryingProfile ? (
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
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex hover:bg-white/20 touch-feedback"
                onClick={handleSignInClick}
              >
                Sign In
              </Button>
              <Button
                size="sm"
                className="hidden sm:inline-flex touch-feedback"
                onClick={handleSignUpClick}
              >
                Sign Up
              </Button>
              
              {/* Mobile auth buttons - smaller */}
              <Button
                variant="ghost"
                size="sm"
                className="sm:hidden text-xs px-2 hover:bg-white/20 touch-feedback"
                onClick={handleSignInClick}
              >
                Sign In
              </Button>
              <Button
                size="sm"
                className="sm:hidden text-xs px-2 touch-feedback"
                onClick={handleSignUpClick}
              >
                Sign Up
              </Button>
            </>
          ) : user ? (
            <>
              <div className="hidden md:flex items-center gap-2">
                <Link href="/wallet" className="cursor-pointer">
                  <Button variant="ghost" className="h-8 px-2 bg-white/10 hover:bg-white/20 text-white/80 touch-feedback">
                    <WalletIcon className="h-4 w-4 mr-1" />
                    <span className="text-sm">{walletBalance === null ? '—' : `${Math.trunc(walletBalance)} pts`}</span>
                  </Button>
                </Link>
                <Link href="/wallet?tab=payouts" className="cursor-pointer">
                  <Button variant="ghost" className="h-8 px-3 bg-white/10 hover:bg-white/20 text-white/80 touch-feedback">
                    <Coins className="h-4 w-4 mr-1" />
                    <span className="text-sm">{earningsDisplay}</span>
                  </Button>
                </Link>
              </div>
              <div className="hidden md:flex items-center gap-2">
                <Link href="/messages" className="cursor-pointer">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 touch-feedback">
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href={`/profile/${userProfile?.username || ''}`} className="cursor-pointer">
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0 avatar-feedback cursor-pointer">
                    <Avatar className="h-8 w-8 border-4 border-white/20">
                      <AvatarImage src={userProfile?.profile_picture || undefined} alt={userProfile?.username || user.email || "User"} />
                      <AvatarFallback className="text-xs">
                        {userProfile ? userInitials : "..."}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </Link>
              </div>
            </>
          ) : null}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="h-8 w-8 hover:bg-white/20 touch-feedback"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4 text-white/80" />
            ) : (
              <Maximize2 className="h-4 w-4 text-white/80" />
            )}
          </Button>
          
          {/* Mobile menu button - far right */}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="h-8 w-8 hover:bg-white/20 touch-feedback"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-4 w-4" />
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
