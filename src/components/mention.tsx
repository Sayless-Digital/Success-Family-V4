"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface MentionProps {
  username: string
  className?: string
}

interface UserData {
  id: string
  username: string
  first_name: string | null
  last_name: string | null
  profile_picture: string | null
}

export function Mention({ username, className }: MentionProps) {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!username) {
      setLoading(false)
      return
    }

    const fetchUser = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, username, first_name, last_name, profile_picture')
          .eq('username', username)
          .maybeSingle()

        if (error) throw error

        if (data) {
          setUserData(data)
        }
      } catch (error) {
        console.error('Error fetching user for mention:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [username])

  // If loading or no user data, show plain @username
  if (loading || !userData) {
    return (
      <span className={cn("text-white/80", className)}>
        @{username}
      </span>
    )
  }

  const fullName = `${userData.first_name || ""} ${userData.last_name || ""}`.trim() || userData.username

  return (
    <Link
      href={`/profile/${userData.username}`}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "mention inline-flex items-center gap-1.5 bg-white/10 text-white/90 pl-0.5 pr-1.5 py-0 rounded-full text-sm hover:bg-white/20 transition-colors",
        className
      )}
    >
      {userData.profile_picture && (
        <Avatar className="h-4 w-4" hideChristmasHat={true}>
          <AvatarImage src={userData.profile_picture} alt={fullName} />
          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white/80 text-xs">
            {userData.first_name?.[0] || ""}{userData.last_name?.[0] || ""}
          </AvatarFallback>
        </Avatar>
      )}
      <span>{fullName}</span>
    </Link>
  )
}

