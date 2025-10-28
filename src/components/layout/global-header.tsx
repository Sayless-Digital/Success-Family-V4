"use client"

import * as React from "react"
import Link from "next/link"
import { Sidebar, LogOut, Shield, CreditCard, Users, ChevronDown, Home, User } from "lucide-react"
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

interface GlobalHeaderProps {
  onMenuClick: () => void
  isSidebarOpen: boolean
  isMobile?: boolean
}

export function GlobalHeader({ onMenuClick, isSidebarOpen, isMobile = false }: GlobalHeaderProps) {
  const { user, userProfile, signOut, isLoading } = useAuth()
  const [authDialogOpen, setAuthDialogOpen] = React.useState(false)
  const [authDialogTab, setAuthDialogTab] = React.useState<"signin" | "signup">("signin")
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

  const handleSignOut = async () => {
    await signOut()
    toast.success("Signed out successfully!")
  }


  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-[9999] h-12 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md rounded-b-lg">
      <div className="h-full px-2 flex items-center justify-between">
        {/* Left side - Menu Button (desktop only) and Logo */}
        <div className="flex items-center gap-2">
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="h-8 w-8"
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
                  className="h-auto p-1 gap-2 hover:bg-white/20 data-[state=open]:bg-white/20"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm border border-white/20 shadow-lg backdrop-blur-md">
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
                    <DropdownMenuItem asChild>
                      <Link href="/create-community" className="cursor-pointer">
                        <Users className="mr-2 h-4 w-4" />
                        <span>Create Community</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    {userCommunities.map((community) => (
                      <DropdownMenuItem key={community.id} asChild>
                        <Link 
                          href={`/${community.slug}`} 
                          className="cursor-pointer"
                          onClick={() => isMobile && onMenuClick()}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <div className="h-8 w-8 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm border border-white/20 shadow-lg backdrop-blur-md flex-shrink-0">
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
                    <DropdownMenuItem asChild>
                      <Link href="/create-community" className="cursor-pointer">
                        <Users className="mr-2 h-4 w-4" />
                        <span>Create Community</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm border border-white/20 shadow-lg backdrop-blur-md">
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
                className="hidden sm:inline-flex"
                onClick={handleSignInClick}
              >
                Sign In
              </Button>
              <Button
                size="sm"
                className="hidden sm:inline-flex"
                onClick={handleSignUpClick}
              >
                Sign Up
              </Button>
              
              {/* Mobile auth buttons - smaller */}
              <Button
                variant="ghost"
                size="sm"
                className="sm:hidden text-xs px-2"
                onClick={handleSignInClick}
              >
                Sign In
              </Button>
              <Button
                size="sm"
                className="sm:hidden text-xs px-2"
                onClick={handleSignUpClick}
              >
                Sign Up
              </Button>
            </>
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={userProfile?.profile_picture || undefined} alt={userProfile?.username || user.email || "User"} />
                    <AvatarFallback className="text-xs">
                      {userProfile ? userInitials : "..."}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {userProfile?.first_name && userProfile?.last_name
                        ? `${userProfile.first_name} ${userProfile.last_name}`
                        : user.email?.split('@')[0] || "User"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Account</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/billing" className="cursor-pointer">
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Billing & Payments</span>
                  </Link>
                </DropdownMenuItem>
                {userProfile?.role === 'admin' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="cursor-pointer">
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Admin Dashboard</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          
          {/* Mobile menu button - far right */}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="h-8 w-8"
              aria-label="Toggle sidebar"
            >
              <Sidebar className="h-4 w-4" />
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
    </>
  )
}
