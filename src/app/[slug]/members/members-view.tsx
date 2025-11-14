"use client"

import React, { useState, useMemo } from "react"
import Link from "next/link"
import { Crown, Calendar, Search } from "lucide-react"
import { CommunityNavigation } from "@/components/community-navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

interface CommunityMembersViewProps {
  community: {
    id: string
    name: string
    slug: string
    description?: string
    owner_id: string
  }
  members: Array<{
    id: string
    role: 'owner' | 'member'
    joined_at: string
    user: {
      id: string
      username: string
      first_name: string
      last_name: string
      profile_picture?: string
      bio?: string
    }
  }>
  userMembership: any
  isOwner: boolean
  currentUserId?: string
}

export default function CommunityMembersView({
  community,
  members,
  userMembership,
  isOwner,
  currentUserId
}: CommunityMembersViewProps) {
  const [searchQuery, setSearchQuery] = useState("")

  // Sort members: owner first, then by join date
  const sortedMembers = useMemo(() => {
    const sorted = [...members].sort((a, b) => {
      if (a.role === 'owner' && b.role !== 'owner') return -1
      if (a.role !== 'owner' && b.role === 'owner') return 1
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    })

    // Filter by search query
    if (!searchQuery) return sorted
    
    return sorted.filter((member) => {
      const fullName = `${member.user.first_name} ${member.user.last_name}`.toLowerCase()
      const username = member.user.username.toLowerCase()
      const search = searchQuery.toLowerCase()
      return fullName.includes(search) || username.includes(search)
    })
  }, [members, searchQuery])

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        {/* Navigation Tabs */}
        <CommunityNavigation 
          slug={community.slug} 
          isOwner={isOwner} 
          isMember={!!userMembership}
          communityOwnerId={community.owner_id}
        />

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40"
          />
        </div>

        {/* Members List */}
        <div className="grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedMembers.map((member) => (
            <Link 
              key={member.id} 
              href={`/profile/${member.user.username}`}
              className="group"
            >
              <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 hover:bg-white/15 transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <Avatar className="h-16 w-16 border-4 border-white/20" userId={member.user.id}>
                      <AvatarImage src={member.user.profile_picture} alt={`${member.user.first_name} ${member.user.last_name}`} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-xl">
                        {member.user.first_name[0]}{member.user.last_name[0]}
                      </AvatarFallback>
                    </Avatar>

                    {/* Member Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-white truncate">
                          {member.user.first_name} {member.user.last_name}
                        </h3>
                        {member.role === 'owner' && (
                          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                            <Crown className="h-3 w-3 mr-1" />
                            Owner
                          </Badge>
                        )}
                      </div>
                      <p className="text-white/60 text-sm truncate mb-3 group-hover:text-white/80 transition-colors">
                        @{member.user.username}
                      </p>
                      <div className="flex items-center gap-1 text-white/40 text-xs">
                        <Calendar className="h-3 w-3" />
                        <span>Joined {new Date(member.joined_at).toLocaleDateString()}</span>
                      </div>
                      {member.user.bio && (
                        <p className="text-white/50 text-xs mt-3 line-clamp-2">
                          {member.user.bio}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Empty State */}
        {members.length === 0 && (
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardContent className="p-12 text-center">
              <div className="mx-auto w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-6">
                <Crown className="h-8 w-8 text-white/60" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Members Yet</h3>
              <p className="text-white/60 max-w-md mx-auto">
                This community doesn't have any members yet. Share the community link to invite people!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

