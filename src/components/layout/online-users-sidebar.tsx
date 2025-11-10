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
}

interface UserProfile {
  id: string
  username: string
  first_name: string | null
  last_name: string | null
  profile_picture: string | null
}

export function OnlineUsersSidebar({ isMobile }: OnlineUsersSidebarProps) {
  const [allUsers, setAllUsers] = useState<UserProfile[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const { onlineUserIds } = useOnlineStatus()
  const { user } = useAuth()

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

  // Filter online users based on search
  useEffect(() => {
    // Filter out current user and only show online users
    const currentUserId = user?.id
    
    // Debug: Log filtering info
    if (process.env.NODE_ENV === 'development') {
      console.log('[OnlineUsersSidebar] All users:', allUsers.length)
      console.log('[OnlineUsersSidebar] Online user IDs:', Array.from(onlineUserIds))
      console.log('[OnlineUsersSidebar] Current user ID:', currentUserId)
    }
    
    const onlineUsers = allUsers.filter(u => 
      u.id !== currentUserId && onlineUserIds.has(u.id)
    )
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[OnlineUsersSidebar] Filtered online users:', onlineUsers.length)
    }
    
    if (!searchQuery.trim()) {
      setFilteredUsers(onlineUsers)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = onlineUsers.filter(u =>
        u.first_name?.toLowerCase().includes(query) ||
        u.last_name?.toLowerCase().includes(query) ||
        u.username?.toLowerCase().includes(query)
      )
      setFilteredUsers(filtered)
    }
  }, [searchQuery, allUsers, onlineUserIds, user?.id])

  // Don't show on mobile
  if (isMobile) return null

  const sidebarClasses = cn(
    "fixed w-64 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md transition-all duration-300 ease-in-out z-[9000] rounded-lg border border-white/20",
    "top-14 right-2", // 3rem header + 0.5rem gap = 3.5rem
    "h-[calc(100dvh-3.5rem-0.5rem)]" // 100dvh - sidebar top (3.5rem) - bottom spacing (0.5rem)
  )

  return (
    <aside className={sidebarClasses}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/20">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-white/70" />
            <h3 className="text-white font-semibold text-base">
              Online Users
            </h3>
            <span className="text-white/60 text-xs ml-auto">
              {filteredUsers.length}
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
              {filteredUsers.map((user) => (
                <Link
                  key={user.id}
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
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

