"use client"

import * as React from "react"
import Link from "next/link"
import { Wallet as WalletIcon, Coins, MessageCircle, Home } from "lucide-react"
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
      return "$0.00 TTD"
    }
    const formatted = earningsDollarValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return `$${formatted} TTD`
  }, [earningsDollarValue])
  
  const walletDisplay = React.useMemo(() => {
    if (walletBalance === null) {
      return "0 pts"
    }
    const balance = Math.trunc(walletBalance)
    // Format large numbers with K/M suffix for mobile
    if (balance >= 1000000) {
      return `${(balance / 1000000).toFixed(1)}M pts`
    }
    if (balance >= 1000) {
      return `${(balance / 1000).toFixed(1)}K pts`
    }
    return `${balance} pts`
  }, [walletBalance])
  
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
              className="h-10 px-2 bg-white/10 hover:bg-white/20 text-white/80 touch-feedback"
            >
              <WalletIcon className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
              <span className="text-xs font-semibold whitespace-nowrap">
                {walletDisplay}
              </span>
            </Button>
          </Link>
          <Link href="/wallet?tab=payouts" prefetch={true}>
            <Button
              variant="ghost"
              className="h-10 px-2 bg-white/10 hover:bg-white/20 text-white/80 touch-feedback"
            >
              <Coins className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
              <span className="text-xs font-semibold whitespace-nowrap">
                {earningsDisplay}
              </span>
            </Button>
          </Link>
        </div>

        {/* Right side - Messages, Home Feed, Profile */}
        <div className="flex items-center gap-1.5">
          <Link href="/messages" prefetch={true}>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white/80 touch-feedback"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/" prefetch={true}>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white/80 touch-feedback"
            >
              <Home className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/profile/${userProfile?.username || ''}`} prefetch={true}>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full p-[2px] avatar-feedback">
              <Avatar className="h-full w-full border-2 border-white/20">
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

