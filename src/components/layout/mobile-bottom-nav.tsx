"use client"

import * as React from "react"
import Link from "next/link"
import { Wallet as WalletIcon, Coins, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/components/auth-provider"

interface MobileBottomNavProps {
  isMobile: boolean
}

export function MobileBottomNav({ isMobile }: MobileBottomNavProps) {
  const { user, userProfile, walletBalance, walletEarningsBalance, userValuePerPoint } = useAuth()
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

  // Only show on mobile
  if (!isMobile || !user) {
    return null
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[9999] h-12 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md rounded-t-lg border-t border-white/20">
      <div className="h-full px-1 flex items-center justify-between">
        {/* Quick actions */}
        <div className="flex items-center gap-1">
          <Link href="/wallet" prefetch={true}>
            <Button 
              variant="ghost" 
              className="h-10 px-4 bg-white/10 hover:bg-white/20 text-white/80 touch-feedback"
            >
              <WalletIcon className="h-4 w-4 mr-2" />
              <span className="text-sm font-semibold">
                {walletBalance === null ? '—' : `${Math.trunc(walletBalance)} pts`}
              </span>
            </Button>
          </Link>
          <Link href="/wallet?tab=payouts" prefetch={true}>
            <Button
              variant="ghost"
              className="h-10 px-4 bg-white/10 hover:bg-white/20 text-white/80 touch-feedback"
            >
              <Coins className="h-4 w-4 mr-2" />
              <span className="text-sm font-semibold">
                {earningsDisplay}
              </span>
            </Button>
          </Link>
        </div>

        {/* Right side - User Profile */}
        <div className="flex items-center gap-2">
          <Link href="/messages" prefetch={true}>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white/80 touch-feedback"
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
          </Link>
          <Link href={`/profile/${userProfile?.username || ''}`} prefetch={true}>
            <Button variant="ghost" className="relative h-11 w-11 rounded-full p-[3px] avatar-feedback">
              <Avatar className="h-[38px] w-[38px] border-2 border-white/20">
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
      </div>
    </nav>
  )
}

