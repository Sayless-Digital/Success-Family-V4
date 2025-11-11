"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { Users, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useOnlineStatus } from "@/components/online-status-provider"
import { useAuth } from "@/components/auth-provider"

interface OnlineUsersSidebarProps {
  isMobile: boolean
  isOpen: boolean
  isPinned: boolean
  onClose: () => void
  onHoverChange?: (isHovered: boolean) => void
}

interface UserProfile {
  id: string
  username: string
  first_name: string | null
  last_name: string | null
  profile_picture: string | null
}

export function OnlineUsersSidebar({ isMobile, isOpen, isPinned, onClose, onHoverChange }: OnlineUsersSidebarProps) {
  const [allUsers, setAllUsers] = useState<UserProfile[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const { onlineUserIds } = useOnlineStatus()
  const { user, userProfile } = useAuth()

  const handleHoverEnter = () => {
    if (!isMobile && !isPinned) {
      onHoverChange?.(true)
    }
  }

  const handleHoverLeave = () => {
    // Don't signal hover leave immediately - allow time to move to sidebar
    // The sidebar's onMouseEnter will keep it open if mouse moves there
  }

  const handleSidebarMouseEnter = () => {
    // Keep sidebar open when hovering over it - signal hover state to parent
    if (!isMobile && !isPinned) {
      onHoverChange?.(true)
    }
  }


  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, username, first_name, last_name, profile_picture')
          .order('first_name', { ascending: true })
          .order('last_name', { ascending: true })

        if (error) throw error
        setAllUsers(data || [])
      } catch (error) {
        console.error('Error fetching users:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [])

  // Filter and sort users: all online users first, then divider, then all offline users
  useEffect(() => {
    const currentUserId = user?.id
    
    // Get all users (including current user)
    let allUsersList = [...allUsers]
    
    // If current user is online but not in allUsers, add them using userProfile
    if (currentUserId && onlineUserIds.has(currentUserId)) {
      const currentUserInAllUsers = allUsersList.some(u => u.id === currentUserId)
      if (!currentUserInAllUsers && userProfile) {
        allUsersList.push({
          id: userProfile.id,
          username: userProfile.username,
          first_name: userProfile.first_name || null,
          last_name: userProfile.last_name || null,
          profile_picture: userProfile.profile_picture || null,
        })
      }
    }
    
    // Apply search filter if present
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      allUsersList = allUsersList.filter(u =>
        u.first_name?.toLowerCase().includes(query) ||
        u.last_name?.toLowerCase().includes(query) ||
        u.username?.toLowerCase().includes(query)
      )
    }
    
    // Separate online and offline users
    const onlineUsers = allUsersList.filter(u => onlineUserIds.has(u.id))
    const offlineUsers = allUsersList.filter(u => !onlineUserIds.has(u.id))
    
    // Sort online users: current user first, then others alphabetically
    const sortedOnlineUsers = onlineUsers.sort((a, b) => {
      // Current user always comes first
      if (a.id === currentUserId) return -1
      if (b.id === currentUserId) return 1
      
      // For other users, sort alphabetically
      const aFirstName = (a.first_name || '').toLowerCase()
      const bFirstName = (b.first_name || '').toLowerCase()
      if (aFirstName !== bFirstName) {
        return aFirstName.localeCompare(bFirstName)
      }
      const aLastName = (a.last_name || '').toLowerCase()
      const bLastName = (b.last_name || '').toLowerCase()
      return aLastName.localeCompare(bLastName)
    })
    
    // Sort offline users alphabetically
    const sortedOfflineUsers = offlineUsers.sort((a, b) => {
      const aFirstName = (a.first_name || '').toLowerCase()
      const bFirstName = (b.first_name || '').toLowerCase()
      if (aFirstName !== bFirstName) {
        return aFirstName.localeCompare(bFirstName)
      }
      const aLastName = (a.last_name || '').toLowerCase()
      const bLastName = (b.last_name || '').toLowerCase()
      return aLastName.localeCompare(bLastName)
    })
    
    // Build final list: online users first, then offline users
    // We'll add a divider marker in the rendering logic
    const finalList: UserProfile[] = []
    finalList.push(...sortedOnlineUsers)
    finalList.push(...sortedOfflineUsers)
    
    setFilteredUsers(finalList)
  }, [searchQuery, allUsers, onlineUserIds, user?.id, userProfile])
  
  // Calculate online user count (including current user if they're online)
  const onlineUserCount = React.useMemo(() => {
    return onlineUserIds.size
  }, [onlineUserIds])

  // Determine if sidebar should be visible (same logic as global sidebar)
  const shouldShowSidebar = isMobile ? isOpen : (isPinned || isOpen)
  
  // On desktop when unpinned, always allow pointer events for hover tracking
  // This ensures the sidebar can receive mouse events even during transitions
  const allowPointerEvents = !isMobile && !isPinned

  const sidebarClasses = cn(
    "fixed w-64 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md transition-all duration-300 ease-in-out rounded-lg border border-white/20",
    {
      // Mobile: slide from right (same as global sidebar)
      "top-14 right-2 left-auto": isMobile,
      "h-[calc(100dvh-3.5rem-3rem-0.5rem)]": isMobile, // 100dvh - sidebar top (3.5rem) - bottom nav (3rem) - bottom gap (0.5rem)
      "z-[9000]": isMobile,
      // Desktop: slide from right (same as global sidebar but on right side)
      "top-14 right-2": !isMobile,
      "h-[calc(100dvh-3.5rem-0.5rem)]": !isMobile, // 100dvh - sidebar top (3.5rem) - bottom spacing (0.5rem)
      "z-[9001]": !isMobile, // Higher z-index than trigger to ensure it's on top
      // Show/hide based on state
      "translate-x-0": shouldShowSidebar,
      "translate-x-full": !shouldShowSidebar,
      // Hide visually when not showing
      "opacity-0": !shouldShowSidebar,
      // Pointer events: always allow on desktop when unpinned (for hover), otherwise disable when hidden
      "pointer-events-none": allowPointerEvents ? false : !shouldShowSidebar,
    }
  )

  return (
    <>
      {/* Desktop hover trigger area when unpinned (same as global sidebar) */}
      {/* Keep trigger visible even when sidebar is open to maintain hover continuity */}
      {!isMobile && !isPinned && (
        <div
          className="fixed top-14 right-0 w-8 h-[calc(100dvh-3.5rem)] z-[8999]"
          onMouseEnter={handleHoverEnter}
          onMouseLeave={handleHoverLeave}
        />
      )}

      {/* Sidebar */}
      <aside
        className={sidebarClasses}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={() => {
          // Notify parent that mouse left - parent will handle closing with delay
          if (!isPinned && !isMobile) {
            onHoverChange?.(false)
          }
        }}
      >
        <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/20">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-white/70" />
            <h3 className="text-white font-semibold text-base">
              Online Users
            </h3>
            <span className="ml-auto flex items-center justify-center min-h-6 min-w-6 h-6 px-2 rounded-full bg-white/20 text-white font-bold text-xs">
              {onlineUserCount}
            </span>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <Input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:border-white/30"
            />
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-white/60 text-sm">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/60 text-sm">
                {searchQuery ? "No users found" : "No users"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user, index) => {
                const isOnline = onlineUserIds.has(user.id)
                const prevUser = index > 0 ? filteredUsers[index - 1] : null
                const prevIsOnline = prevUser ? onlineUserIds.has(prevUser.id) : false
                
                // Show divider between online and offline users
                // Divider appears when transitioning from online (prev user) to offline (current user)
                const showDivider = prevIsOnline && !isOnline
                
                return (
                  <React.Fragment key={user.id}>
                    {showDivider && (
                      <div className="my-3 border-t border-white/20" />
                    )}
                    <Link
                      href={`/profile/${user.username}`}
                      className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-200 group"
                    >
                      <Avatar className="h-10 w-10 border-2 border-white/20 flex-shrink-0" userId={user.id}>
                        <AvatarImage src={user.profile_picture || ""} alt={`${user.first_name} ${user.last_name}`} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white text-sm">
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate group-hover:text-white/90">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-white/60 text-xs truncate group-hover:text-white/70">
                          @{user.username}
                        </p>
                      </div>
                    </Link>
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </div>
      </div>
      </aside>
          </>
        )
      }

