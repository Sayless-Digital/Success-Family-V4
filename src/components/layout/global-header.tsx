"use client"

import * as React from "react"
import Link from "next/link"
import { Sidebar, LogOut, Shield } from "lucide-react"
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

interface GlobalHeaderProps {
  onMenuClick: () => void
  isSidebarOpen: boolean
  isMobile?: boolean
}

export function GlobalHeader({ onMenuClick, isSidebarOpen, isMobile = false }: GlobalHeaderProps) {
  const { user, userProfile, signOut, isLoading } = useAuth()
  const [authDialogOpen, setAuthDialogOpen] = React.useState(false)
  const [authDialogTab, setAuthDialogTab] = React.useState<"signin" | "signup">("signin")
  
  // Memoize user initials to prevent unnecessary re-renders
  const userInitials = React.useMemo(() => {
    if (!userProfile) return "U"
    const firstInitial = userProfile.first_name?.[0] || ""
    const lastInitial = userProfile.last_name?.[0] || ""
    return (firstInitial + lastInitial).toUpperCase() || "U"
  }, [userProfile?.first_name, userProfile?.last_name])

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
    <header className="fixed top-0 left-0 right-0 z-50 h-12 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md rounded-b-lg">
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
          
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm border border-white/20 shadow-lg backdrop-blur-md">
              SF
            </div>
            <span className="font-semibold text-white hidden sm:block">
              Success Family
            </span>
          </div>
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
