"use client"

import Link from "next/link"
import { Users, Calendar, Globe, Building2, Search, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { CreateCommunityDialog } from "@/components/create-community-dialog"
import { useAuth } from "@/components/auth-provider"
import { AuthDialog } from "@/components/auth-dialog"

interface Community {
  id: string
  name: string
  slug: string
  description?: string
  created_at: string
  is_active: boolean
  owner: {
    id: string
    username: string
    first_name: string
    last_name: string
  }
  memberCount: number
}

interface CommunitiesListProps {
  communities: Community[]
}

export default function CommunitiesList({ communities }: CommunitiesListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const { user } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  // Filter communities based on search query
  const filteredCommunities = communities.filter((community) =>
    community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    community.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        <PageHeader
          title="Explore Communities"
          subtitle="Discover and join communities of like-minded individuals"
        />

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            type="text"
            placeholder="Search communities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40"
          />
        </div>

        {/* Communities Grid */}
        {filteredCommunities.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-16 w-16 text-white/40 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {searchQuery ? 'No communities found' : 'No communities yet'}
            </h3>
            <p className="text-white/60 mb-4">
              {searchQuery 
                ? 'Try adjusting your search terms'
                : 'Be the first to create a community!'}
            </p>
            <Button onClick={() => (user ? setCreateOpen(true) : setAuthOpen(true))}>
              Create Community
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCommunities.map((community) => (
              <Link key={community.id} href={`/${community.slug}`}>
                <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 hover:bg-white/15 transition-all cursor-pointer h-full">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Community Header */}
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg border border-white/20 shadow-lg backdrop-blur-md flex-shrink-0">
                          {community.name[0]}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <h3 className="font-semibold text-white text-lg truncate">
                            {community.name}
                          </h3>
                          <div className="flex items-center gap-2">
                            <Crown className="h-3 w-3 text-yellow-500" />
                            <p className="text-white/60 text-sm truncate">
                              {community.owner.first_name} {community.owner.last_name}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      {community.description ? (
                        <p className="text-white/80 text-sm line-clamp-2">
                          {community.description}
                        </p>
                      ) : (
                        <p className="text-white/50 text-sm italic">
                          No description yet
                        </p>
                      )}

                      {/* Stats */}
                      <div className="border-t border-white/10 pt-3 space-y-2">
                        <div className="flex items-center gap-3 text-white/60 text-sm">
                          <Badge variant="secondary" className="text-xs bg-white/10 text-white/80">
                            <Users className="h-3 w-3 mr-1" />
                            {community.memberCount}
                          </Badge>
                          <div className="flex items-center gap-1 text-white/50 text-xs">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(community.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                          </div>
                        </div>
                        
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Create Community CTA */}
        {filteredCommunities.length > 0 && (
          <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border-0">
            <CardContent className="p-8 text-center">
              <div className="max-w-md mx-auto">
                <Building2 className="h-12 w-12 text-white/70 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-3">Create Your Own Community</h3>
                <p className="text-white/80 mb-6 leading-relaxed">
                  Start a community and connect with others who share your interests and goals.
                </p>
                <Button size="lg" onClick={() => (user ? setCreateOpen(true) : setAuthOpen(true))}>
                  Create Community
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        <CreateCommunityDialog open={createOpen} onOpenChange={setCreateOpen} />
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultTab="signin" />
      </div>
    </div>
  )
}

