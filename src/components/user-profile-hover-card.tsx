"use client"

import React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { UserPlus, MessageCircle, User as UserIcon, Loader2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { toast } from "sonner"
import type { User } from "@/types"

interface UserProfileHoverCardProps {
  userId: string
  username: string
  firstName: string
  lastName: string
  profilePicture?: string | null
  bio?: string | null
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function UserProfileHoverCard({
  userId,
  username,
  firstName,
  lastName,
  profilePicture,
  bio,
  children,
  open,
  onOpenChange,
}: UserProfileHoverCardProps) {
  const router = useRouter()
  const { user: currentUser } = useAuth()
  const [followStatus, setFollowStatus] = React.useState<{
    isFollowing: boolean
    isFollowedBy: boolean
  } | null>(null)
  const [isFollowingLoading, setIsFollowingLoading] = React.useState(false)
  const [isMessageLoading, setIsMessageLoading] = React.useState(false)
  const [internalOpen, setInternalOpen] = React.useState(false)
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const isMobileRef = React.useRef(false)

  const isOwnProfile = currentUser?.id === userId
  const isControlled = open !== undefined && onOpenChange !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen

  // Detect mobile on mount
  React.useEffect(() => {
    const checkMobile = () => {
      isMobileRef.current = window.innerWidth < 768 || 'ontouchstart' in window
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle hover for desktop, click for mobile
  const handleMouseEnter = () => {
    if (isMobileRef.current) return // Only hover on desktop
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsOpen(true)
  }

  const handleMouseLeave = () => {
    if (isMobileRef.current) return // Only hover on desktop
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 150) // Small delay to allow moving to popover
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isMobileRef.current) {
      setIsOpen(!isOpen)
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

  // Fetch follow status when popover opens
  React.useEffect(() => {
    if (!isOpen || !currentUser || isOwnProfile) {
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
  }, [isOpen, currentUser, userId, isOwnProfile])

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!currentUser || isOwnProfile) return

    setIsFollowingLoading(true)
    try {
      if (followStatus?.isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from("user_follows")
          .delete()
          .eq("follower_id", currentUser.id)
          .eq("followed_id", userId)

        if (error) throw error

        setFollowStatus((prev) => prev ? { ...prev, isFollowing: false } : null)
        toast.success("Unfollowed")
      } else {
        // Follow
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

    if (!currentUser || isOwnProfile) {
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
      
      setIsOpen(false)
      
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
    
    setIsOpen(false)
    
    router.push(`/profile/${username}`)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger 
        asChild
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div 
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="relative z-10 inline-block"
        >
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 p-0"
        align="start"
        side="bottom"
        sideOffset={8}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ zIndex: 9999 }}
      >
        <div className="p-3 space-y-3">
          {/* User Info */}
          <div className="flex items-start gap-3">
            <Avatar className="h-14 w-14 border-2 border-white/20 flex-shrink-0" userId={userId}>
              <AvatarImage src={profilePicture || undefined} alt={`${firstName} ${lastName}`} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-lg">
                {firstName[0]}{lastName[0]}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white text-sm truncate">
                {firstName} {lastName}
              </h3>
              <p className="text-white/60 text-xs truncate">
                @{username}
              </p>
              {bio && (
                <p className="text-white/50 text-xs mt-1.5 line-clamp-2">
                  {bio}
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
              >
                <UserIcon className="h-3.5 w-3.5 mr-1" />
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
            >
              <UserIcon className="h-3.5 w-3.5 mr-1.5" />
              View Profile
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

