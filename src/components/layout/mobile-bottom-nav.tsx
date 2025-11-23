"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Wallet as WalletIcon, Coins, MessageCircle, Home, LogIn, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { AuthDialog } from "@/components/auth-dialog"
import { useAuth } from "@/components/auth-provider"
import { useUnreadMessagesCount } from "@/hooks/use-unread-messages-count"
import { Badge } from "@/components/ui/badge"

interface MobileBottomNavProps {
  isMobile: boolean
}

export function MobileBottomNav({ isMobile }: MobileBottomNavProps) {
  const pathname = usePathname()
  const { user, userProfile, walletBalance, walletEarningsBalance, userValuePerPoint, isLoading, walletDataLoaded } = useAuth()
  const [authDialogOpen, setAuthDialogOpen] = React.useState(false)
  const [authDialogTab, setAuthDialogTab] = React.useState<"signin" | "signup">("signin")
  const { unreadCount } = useUnreadMessagesCount(user?.id ?? null)
  
  // Check if we're on the home page
  const isHomePage = pathname === "/"
  
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

  // Determine loading states
  // Show skeleton only while wallet data is actively loading, not when it's null (null is valid state)
  const isWalletLoading = Boolean(user && !walletDataLoaded)
  const isProfileLoading = Boolean(user && !userProfile && !isLoading)
  // Show wallet skeletons only when user exists and wallet data is loading
  const showWalletSkeletons = user && isWalletLoading

  // Only show on mobile - always render the bar structure immediately
  if (!isMobile) {
    return null
  }

  // Show wallet buttons if user is authenticated (show skeletons while loading wallet data)
  const showWalletButtons = user
  // Show auth buttons if no user and not loading
  const showAuthButtons = !user && !isLoading
  // Show auth button skeletons if no user and still loading
  const showAuthButtonSkeletons = !user && isLoading

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-[9999] h-12 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md rounded-t-lg border-t border-white/20"
        data-mobile-bottom-nav
      >
        <div className="h-full px-1 flex items-center justify-between">
          {/* Left side - Wallet & Earnings (when logged in) OR Sign In/Sign Up (when logged out) */}
          <div className="flex items-center gap-1">
            {showWalletButtons ? (
              <>
                <Link href="/wallet" prefetch={true}>
                  <Button 
                    variant="ghost" 
                    className="h-10 px-2 bg-white/10 hover:bg-white/20 text-white/80 touch-feedback"
                    disabled={isWalletLoading}
                  >
                    <WalletIcon className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                    {showWalletSkeletons ? (
                      <Skeleton className="h-3 w-12 bg-white/20" />
                    ) : (
                      <span className="text-xs font-semibold whitespace-nowrap">
                        {walletDisplay}
                      </span>
                    )}
                  </Button>
                </Link>
                <Link href="/wallet?tab=payouts" prefetch={true}>
                  <Button
                    variant="ghost"
                    className="h-10 px-2 bg-white/10 hover:bg-white/20 text-white/80 touch-feedback"
                    disabled={isWalletLoading}
                  >
                    <Coins className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                    {showWalletSkeletons ? (
                      <Skeleton className="h-3 w-14 bg-white/20" />
                    ) : (
                      <span className="text-xs font-semibold whitespace-nowrap">
                        {earningsDisplay}
                      </span>
                    )}
                  </Button>
                </Link>
              </>
            ) : showAuthButtons ? (
              <>
                <Button 
                  variant="ghost" 
                  className="h-10 px-3 bg-white/10 hover:bg-white/20 text-white/80 touch-feedback"
                  onClick={() => {
                    setAuthDialogTab("signin")
                    setAuthDialogOpen(true)
                  }}
                >
                  <LogIn className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                  <span className="text-xs font-semibold whitespace-nowrap">
                    Sign In
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  className="h-10 px-3 bg-white/10 hover:bg-white/20 text-white/80 touch-feedback"
                  onClick={() => {
                    setAuthDialogTab("signup")
                    setAuthDialogOpen(true)
                  }}
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                  <span className="text-xs font-semibold whitespace-nowrap">
                    Sign Up
                  </span>
                </Button>
              </>
            ) : showAuthButtonSkeletons ? (
              <>
                <Button 
                  variant="ghost" 
                  className="h-10 px-3 bg-white/10 text-white/80 touch-feedback"
                  disabled
                >
                  <Skeleton className="h-3 w-16 bg-white/20" />
                </Button>
                <Button
                  variant="ghost"
                  className="h-10 px-3 bg-white/10 text-white/80 touch-feedback"
                  disabled
                >
                  <Skeleton className="h-3 w-16 bg-white/20" />
                </Button>
              </>
            ) : null}
          </div>

          {/* Right side - Messages (if logged in), Home, Profile (if logged in) */}
          <div className="flex items-center gap-1.5">
            {user ? (
              <>
                <Link href="/messages" prefetch={true} className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white/80 touch-feedback"
                  >
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
                <Link href="/" prefetch={true}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full touch-feedback relative overflow-hidden"
                    style={{
                      background: isHomePage 
                        ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(147, 51, 234, 0.3) 100%)'
                        : 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%)',
                      border: '1.5px solid rgba(255, 215, 0, 0.5)',
                      boxShadow: isHomePage 
                        ? '0 0 8px rgba(255, 215, 0, 0.4), 0 0 16px rgba(147, 51, 234, 0.3)'
                        : '0 0 4px rgba(255, 215, 0, 0.3), 0 0 8px rgba(147, 51, 234, 0.2)',
                    }}
                  >
                    <Home 
                      className="h-4 w-4 relative z-10" 
                      style={{
                        background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #9333EA 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        filter: 'drop-shadow(0 0 2px rgba(255, 215, 0, 0.6))',
                      }}
                    />
                  </Button>
                </Link>
                <Link href={`/profile/${userProfile?.username || user.id}`} prefetch={true} className="flex items-center">
                  <Button variant="ghost" className="h-10 w-10 rounded-full p-0 avatar-feedback flex items-center justify-center" disabled={isProfileLoading}>
                    <Avatar className="h-9 w-9 border-2 border-white/20" userId={user?.id}>
                      {userProfile?.profile_picture ? (
                        <AvatarImage 
                          key={`${user.id}-${userProfile.profile_picture}-${userProfile.updated_at || ''}`}
                          src={userProfile.profile_picture} 
                          alt={userProfile?.username || user.email || "User"}
                        />
                      ) : null}
                      <AvatarFallback className="text-xs bg-white/10">
                        {isProfileLoading ? (
                          <Skeleton className="h-full w-full rounded-full bg-white/20" />
                        ) : (
                          userInitials
                        )}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/" prefetch={true}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full touch-feedback relative overflow-hidden"
                    style={{
                      background: isHomePage 
                        ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(147, 51, 234, 0.3) 100%)'
                        : 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%)',
                      border: '1.5px solid rgba(255, 215, 0, 0.5)',
                      boxShadow: isHomePage 
                        ? '0 0 8px rgba(255, 215, 0, 0.4), 0 0 16px rgba(147, 51, 234, 0.3)'
                        : '0 0 4px rgba(255, 215, 0, 0.3), 0 0 8px rgba(147, 51, 234, 0.2)',
                    }}
                  >
                    <Home 
                      className="h-4 w-4 relative z-10" 
                      style={{
                        background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #9333EA 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        filter: 'drop-shadow(0 0 2px rgba(255, 215, 0, 0.6))',
                      }}
                    />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
      
      <AuthDialog 
        open={authDialogOpen} 
        onOpenChange={setAuthDialogOpen} 
        defaultTab={authDialogTab}
      />
    </>
  )
}

