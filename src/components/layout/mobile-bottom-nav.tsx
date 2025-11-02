"use client"

import * as React from "react"
import Link from "next/link"
import { Wallet as WalletIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/components/auth-provider"

interface MobileBottomNavProps {
  isMobile: boolean
}

export function MobileBottomNav({ isMobile }: MobileBottomNavProps) {
  const { user, userProfile, walletBalance } = useAuth()
  
  // Memoize user initials to prevent unnecessary re-renders
  const userInitials = React.useMemo(() => {
    if (!userProfile) return "U"
    const firstInitial = userProfile.first_name?.[0] || ""
    const lastInitial = userProfile.last_name?.[0] || ""
    return (firstInitial + lastInitial).toUpperCase() || "U"
  }, [userProfile?.first_name, userProfile?.last_name])

  // Only show on mobile
  if (!isMobile || !user) {
    return null
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[9999] h-12 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md rounded-t-lg border-t border-white/20">
      <div className="h-full px-1 flex items-center justify-between">
        {/* Left side - Points */}
        <Link href="/wallet">
          <Button 
            variant="ghost" 
            className="h-10 px-4 bg-white/10 hover:bg-white/20 text-white/80"
          >
            <WalletIcon className="h-4 w-4 mr-2" />
            <span className="text-sm font-semibold">
              {walletBalance === null ? '—' : `${Math.trunc(walletBalance)} pts`}
            </span>
          </Button>
        </Link>

        {/* Right side - User Profile */}
        <Link href={`/profile/${userProfile?.username || ''}`}>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
            <Avatar className="h-10 w-10 border-2 border-white/20">
              <AvatarImage 
                src={userProfile?.profile_picture || undefined} 
                alt={userProfile?.username || user.email || "User"} 
              />
              <AvatarFallback className="text-xs">
                {userProfile ? userInitials : "..."}
              </AvatarFallback>
            </Avatar>
          </Button>
        </Link>
      </div>
    </nav>
  )
}

