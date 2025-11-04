"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Sidebar, Menu, Users, ChevronDown, Home, Wallet as WalletIcon } from "lucide-react"
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
}

export function GlobalHeader({ onMenuClick, isSidebarOpen, isMobile = false }: GlobalHeaderProps) {
  const { user, userProfile, walletBalance, signOut, isLoading } = useAuth()
  const [authDialogOpen, setAuthDialogOpen] = React.useState(false)
  const [authDialogTab, setAuthDialogTab] = React.useState<"signin" | "signup">("signin")
  const [createOpen, setCreateOpen] = React.useState(false)
  const [userCommunities, setUserCommunities] = React.useState<Community[]>([])
  const [communitiesLoading, setCommunitiesLoading] = React.useState(false)
  
  // Memoize user initials to prevent unnecessary re-renders
  const userInitials = React.useMemo(() => {
    if (!userProfile) return "U"
    const firstInitial = userProfile.first_name?.[0] || ""
    const lastInitial = userProfile.last_name?.[0] || ""
    return (firstInitial + lastInitial).toUpperCase() || "U"
  }, [userProfile?.first_name, userProfile?.last_name])

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



  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-[9999] h-12 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md rounded-b-lg border-b border-white/20">
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
              <DropdownMenuContent className="w-64" align="start" forceMount>
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
            // Show loading state to prevent flash
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
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
            // Hide user profile on mobile (shown in bottom nav)
            <div className="hidden md:block">
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
          ) : null}

          {/* Hide points/wallet on mobile (shown in bottom nav) */}
          {user && (
            <Link href="/wallet" className="ml-1 hidden md:block cursor-pointer">
              <Button variant="ghost" className="h-8 px-2 bg-white/10 hover:bg-white/20 text-white/80 touch-feedback cursor-pointer">
                <WalletIcon className="h-4 w-4 mr-1" />
                <span className="text-sm">{walletBalance === null ? '—' : `${Math.trunc(walletBalance)} pts`}</span>
              </Button>
            </Link>
          )}
          
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
