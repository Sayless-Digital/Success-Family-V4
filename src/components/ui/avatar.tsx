"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { useRouter } from "next/navigation"
import { UserPlus, MessageCircle, User, Loader2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useOnlineStatus } from "@/components/online-status-provider"
import { Skeleton } from "@/components/ui/skeleton"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { toast } from "sonner"

interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  userId?: string
  isOnline?: boolean
  loading?: boolean
  // Hover card props
  showHoverCard?: boolean
  username?: string
  firstName?: string
  lastName?: string
  bio?: string | null
  profilePicture?: string | null
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ 
  className, 
  userId, 
  isOnline, 
  loading, 
  showHoverCard = false,
  username,
  firstName,
  lastName,
  bio,
  profilePicture,
  children, 
  ...props 
}, ref) => {
  const { isUserOnline } = useOnlineStatus()
  const router = useRouter()
  const { user: currentUser } = useAuth()
  const showOnlineIndicator = isOnline !== undefined 
    ? isOnline 
    : userId ? isUserOnline(userId) : false

  // Hover card state
  const [hoverCardOpen, setHoverCardOpen] = React.useState(false)
  const [followStatus, setFollowStatus] = React.useState<{
    isFollowing: boolean
    isFollowedBy: boolean
  } | null>(null)
  const [isFollowingLoading, setIsFollowingLoading] = React.useState(false)
  const [isMessageLoading, setIsMessageLoading] = React.useState(false)
  const [userData, setUserData] = React.useState<{
    username?: string
    firstName?: string
    lastName?: string
    profilePicture?: string | null
    bio?: string | null
  } | null>(null)
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const isMobileRef = React.useRef(false)

  const isOwnProfile = currentUser?.id === userId

  // Detect mobile on mount
  React.useEffect(() => {
    const checkMobile = () => {
      isMobileRef.current = window.innerWidth < 768 || 'ontouchstart' in window
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Always fetch user data when hover card is enabled and userId is provided
  // This makes the hover card self-contained and doesn't depend on pages passing data
  React.useEffect(() => {
    if (!showHoverCard || !userId) {
      setUserData(null)
      return
    }

    const fetchUserData = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('username, first_name, last_name, profile_picture, bio')
          .eq('id', userId)
          .maybeSingle()

        if (error) throw error

        if (data) {
          setUserData({
            username: data.username || undefined,
            firstName: data.first_name || undefined,
            lastName: data.last_name || undefined,
            profilePicture: data.profile_picture || null,
            bio: data.bio || null,
          })
        }
      } catch (error) {
        console.error('Error fetching user data for hover card:', error)
      }
    }

    fetchUserData()
  }, [showHoverCard, userId])

  // Handle hover for desktop, click for mobile
  const handleMouseEnter = () => {
    if (isMobileRef.current || !showHoverCard) return
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setHoverCardOpen(true)
  }

  const handleMouseLeave = () => {
    if (isMobileRef.current || !showHoverCard) return
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setHoverCardOpen(false)
    }, 150)
  }

  const handleClick = (e: React.MouseEvent) => {
    if (!showHoverCard) return
    e.preventDefault()
    e.stopPropagation()
    if (isMobileRef.current) {
      setHoverCardOpen(!hoverCardOpen)
    }
  }

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Fetch follow status when hover card opens
  React.useEffect(() => {
    if (!hoverCardOpen || !currentUser || isOwnProfile || !userId) {
      setFollowStatus(null)
      return
    }

    const fetchFollowStatus = async () => {
      try {
        const [following, followedBy] = await Promise.all([
          supabase
            .from("user_follows")
            .select("follower_id")
            .eq("follower_id", currentUser.id)
            .eq("followed_id", userId)
            .maybeSingle(),
          supabase
            .from("user_follows")
            .select("follower_id")
            .eq("follower_id", userId)
            .eq("followed_id", currentUser.id)
            .maybeSingle(),
        ])

        setFollowStatus({
          isFollowing: !!following.data,
          isFollowedBy: !!followedBy.data,
        })
      } catch (error) {
        console.error("Error fetching follow status:", error)
      }
    }

    fetchFollowStatus()
  }, [hoverCardOpen, currentUser, userId, isOwnProfile])

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!currentUser || isOwnProfile || !userId) return

    setIsFollowingLoading(true)
    try {
      if (followStatus?.isFollowing) {
        const { error } = await supabase
          .from("user_follows")
          .delete()
          .eq("follower_id", currentUser.id)
          .eq("followed_id", userId)

        if (error) throw error

        setFollowStatus((prev) => prev ? { ...prev, isFollowing: false } : null)
        toast.success("Unfollowed")
      } else {
        const { error } = await supabase
          .from("user_follows")
          .upsert(
            {
              follower_id: currentUser.id,
              followed_id: userId,
            },
            { onConflict: "follower_id,followed_id" }
          )

        if (error) throw error

        setFollowStatus((prev) => prev ? { ...prev, isFollowing: true } : null)
        toast.success("Following")
      }
    } catch (error: any) {
      console.error("Error toggling follow:", error)
      toast.error(error.message || "Failed to update follow status")
    } finally {
      setIsFollowingLoading(false)
    }
  }

  const handleMessage = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!currentUser || isOwnProfile || !userId) {
      toast.error("Cannot message yourself")
      return
    }

    setIsMessageLoading(true)
    try {
      const response = await fetch("/api/dm/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerUserId: userId }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData?.error || "Failed to start conversation"
        throw new Error(errorMessage)
      }

      const data = await response.json()
      const threadId = data?.thread?.id ?? data?.threadId
      
      setHoverCardOpen(false)
      
      router.push(threadId ? `/messages?thread=${threadId}` : "/messages")
    } catch (error: any) {
      console.error("Error starting conversation:", error)
      toast.error(error.message || "Unable to start a conversation right now.")
    } finally {
      setIsMessageLoading(false)
    }
  }

  const handleViewProfile = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const finalUsername = username || userData?.username
    if (!finalUsername) return
    
    setHoverCardOpen(false)
    
    router.push(`/profile/${finalUsername}`)
  }

  // Get final user data (fetched data takes precedence, fall back to props)
  // This makes the hover card self-contained - it fetches all data itself
  const finalUsername = userData?.username || username
  const finalFirstName = userData?.firstName || firstName
  const finalLastName = userData?.lastName || lastName
  const finalBio = userData?.bio !== undefined ? userData.bio : (bio !== undefined ? bio : null)
  const finalProfilePicture = profilePicture || userData?.profilePicture || undefined

  // Show hover card if we have userId and either fetched data or props with required fields
  const canShowHoverCard = showHoverCard && userId && (userData || (username && firstName && lastName))

  // Extract size from className to enforce square dimensions via inline styles
  const classStr = className || ''
  let explicitSize: number | undefined
  
  if (classStr.includes('h-24') && classStr.includes('w-24')) {
    explicitSize = 96 // 6rem = 96px
  } else if (classStr.includes('h-10') && classStr.includes('w-10')) {
    explicitSize = 40 // 2.5rem = 40px
  } else if (classStr.includes('h-16') && classStr.includes('w-16')) {
    explicitSize = 64 // 4rem = 64px
  } else if (classStr.includes('h-8') && classStr.includes('w-8')) {
    explicitSize = 32 // 2rem = 32px
  }

  // If loading, show skeleton
  if (loading) {
    const skeletonElement = (
      <Skeleton 
        className={cn(
          "rounded-full shrink-0",
          className
        )}
        style={{
          aspectRatio: "1 / 1",
          ...(explicitSize ? {
            width: `${explicitSize}px`,
            height: `${explicitSize}px`,
            minWidth: `${explicitSize}px`,
            maxWidth: `${explicitSize}px`,
            minHeight: `${explicitSize}px`,
            maxHeight: `${explicitSize}px`,
          } : {}),
        }}
      />
    )
    
    // Wrap skeleton in online ripple div if needed for consistency
    if (showOnlineIndicator) {
      return (
        <div className="avatar-online-ripple">
          {skeletonElement}
        </div>
      )
    }
    
    return skeletonElement
  }

  const avatarRoot = (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative inline-block align-middle shrink-0 rounded-full transition-all duration-200 z-10",
        "overflow-hidden box-border avatar-enforce-square",
        canShowHoverCard && "cursor-pointer",
        showOnlineIndicator
          ? ""
          : "border border-white/20 hover:border-white/40",
        className
      )}
      style={{
        aspectRatio: "1 / 1",
        ...(explicitSize ? {
          width: `${explicitSize}px`,
          height: `${explicitSize}px`,
          minWidth: `${explicitSize}px`,
          maxWidth: `${explicitSize}px`,
          minHeight: `${explicitSize}px`,
          maxHeight: `${explicitSize}px`,
        } : {}),
        ...props.style,
      }}
      onClick={canShowHoverCard ? handleClick : undefined}
      onMouseEnter={canShowHoverCard ? handleMouseEnter : undefined}
      onMouseLeave={canShowHoverCard ? handleMouseLeave : undefined}
      {...props}
    >
      {children}
    </AvatarPrimitive.Root>
  )

  // Wrap in Popover if hover card is enabled
  if (canShowHoverCard) {
    const wrappedAvatar = showOnlineIndicator ? (
      <div className="avatar-online-ripple">
        {avatarRoot}
      </div>
    ) : avatarRoot

    return (
      <Popover open={hoverCardOpen} onOpenChange={setHoverCardOpen} modal={false}>
        <PopoverTrigger asChild>
          <div 
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="relative z-10 inline-block"
            tabIndex={-1}
          >
            {wrappedAvatar}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 p-0"
          align="start"
          side="bottom"
          sideOffset={8}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          style={{ zIndex: 9999 }}
        >
          <div className="p-3 space-y-3">
            {/* User Info */}
            <div className="flex items-start gap-3">
              <AvatarPrimitive.Root className="h-14 w-14 border-2 border-white/20 flex-shrink-0 rounded-full overflow-hidden relative inline-block">
                {finalProfilePicture ? (
                  <AvatarPrimitive.Image 
                    src={finalProfilePicture} 
                    alt={`${finalFirstName} ${finalLastName}`}
                    className="absolute inset-0 h-full w-full object-cover object-center rounded-full"
                  />
                ) : null}
                <AvatarPrimitive.Fallback className="absolute inset-0 flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground backdrop-blur-md text-lg">
                  {finalFirstName?.[0]}{finalLastName?.[0]}
                </AvatarPrimitive.Fallback>
              </AvatarPrimitive.Root>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white text-sm truncate">
                  {finalFirstName} {finalLastName}
                </h3>
                <p className="text-white/60 text-xs truncate">
                  @{finalUsername}
                </p>
                {finalBio && (
                  <p className="text-white/50 text-xs mt-1.5 line-clamp-2">
                    {finalBio}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {currentUser && !isOwnProfile && (
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFollow}
                  disabled={isFollowingLoading || followStatus === null}
                  className="flex-1 bg-white/10 text-white/80 border-white/20 hover:bg-white/20 h-8 text-xs px-2"
                  tabIndex={-1}
                >
                  {isFollowingLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className={cn("h-3.5 w-3.5 mr-1", followStatus?.isFollowing && "hidden")} />
                      <span className="truncate">{followStatus?.isFollowing ? "Following" : "Follow"}</span>
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMessage}
                  disabled={isMessageLoading}
                  className="flex-1 bg-white/10 text-white/80 border-white/20 hover:bg-white/20 h-8 text-xs px-2"
                  tabIndex={-1}
                >
                  {isMessageLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <MessageCircle className="h-3.5 w-3.5 mr-1" />
                      <span className="truncate">Message</span>
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewProfile}
                  className="flex-1 bg-white/10 text-white/80 border-white/20 hover:bg-white/20 h-8 text-xs px-2"
                  tabIndex={-1}
                >
                  <User className="h-3.5 w-3.5 mr-1" />
                  <span className="truncate">Profile</span>
                </Button>
              </div>
            )}

            {!currentUser && (
              <div className="text-center py-2">
                <p className="text-white/60 text-xs">
                  Sign in to follow or message
                </p>
              </div>
            )}

            {isOwnProfile && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewProfile}
                className="w-full bg-white/10 text-white/80 border-white/20 hover:bg-white/20 h-8 text-xs"
                tabIndex={-1}
              >
                <User className="h-3.5 w-3.5 mr-1.5" />
                View Profile
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // Only wrap in div when online indicator is needed (for ripple effect)
  if (showOnlineIndicator) {
    return (
      <div className="avatar-online-ripple">
        {avatarRoot}
      </div>
    )
  }

  // No wrapper needed when no online indicator - render directly
  return avatarRoot
})
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn(
      "absolute inset-0 h-full w-full object-cover object-center rounded-full",
      className
    )}
    style={{
      transformOrigin: 'center center',
      ...props.style,
    }}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "absolute inset-0 flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground backdrop-blur-md",
      className
    )}
    style={{
      transformOrigin: 'center center',
      ...props.style,
    }}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
