"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { FileText, Pin, Eye, Plus } from "lucide-react"
import Aurora from "@/components/Aurora"
import { useAuroraColors } from "@/lib/use-aurora-colors"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { CreatePostDialog } from "@/components/create-post-dialog"
import { useAuth } from "@/components/auth-provider"
import type { Post, User as UserType } from "@/types"

interface PostWithAuthor extends Post {
  author: UserType
}

interface FeedViewProps {
  community: {
    id: string
    name: string
    slug: string
    description?: string
    owner_id: string
  }
  posts: PostWithAuthor[]
  isMember: boolean
  currentUserId?: string
}

export default function FeedView({
  community,
  posts,
  isMember,
  currentUserId
}: FeedViewProps) {
  const router = useRouter()
  const { userProfile } = useAuth()
  const colorStops = useAuroraColors()
  const [createPostOpen, setCreatePostOpen] = useState(false)

  // Sort posts: pinned first, then by published date
  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1
      if (!a.is_pinned && b.is_pinned) return 1
      
      const dateA = new Date(a.published_at || a.created_at).getTime()
      const dateB = new Date(b.published_at || b.created_at).getTime()
      return dateB - dateA
    })
  }, [posts])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-x-hidden">
      {/* Aurora Background */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.3} />
      </div>

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <PageHeader
          title="Feed"
          subtitle={`${posts.length} ${posts.length === 1 ? 'post' : 'posts'} in this community`}
        />

        {/* Inline Post Composer */}
        {isMember && userProfile && (
          <Card
            className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 hover:bg-white/15 transition-colors cursor-pointer rounded-full"
            onClick={() => setCreatePostOpen(true)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-4 border-white/20 flex-shrink-0">
                  <AvatarImage src={userProfile.profile_picture} alt={`${userProfile.first_name} ${userProfile.last_name}`} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm">
                    {userProfile.first_name[0]}{userProfile.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <p className="text-white/50 text-base flex-1">Write something...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Posts List */}
        <div className="space-y-4">
          {sortedPosts.map((post) => (
            <Card 
              key={post.id}
              onClick={() => router.push(`/${community.slug}/feed/${post.id}`)}
              className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 hover:bg-white/15 transition-colors cursor-pointer"
            >
              <CardContent className="p-6">
                {/* Post Header */}
                <div className="flex items-start gap-4 mb-4">
                  {/* Author Avatar */}
                  <Link 
                    href={`/profile/${post.author.username}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0"
                  >
                    <Avatar className="h-10 w-10 border-4 border-white/20">
                      <AvatarImage src={post.author.profile_picture} alt={`${post.author.first_name} ${post.author.last_name}`} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm">
                        {post.author.first_name[0]}{post.author.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                  </Link>

                  {/* Post Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link 
                        href={`/profile/${post.author.username}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-white/80 hover:text-white text-sm font-medium"
                      >
                        @{post.author.username}
                      </Link>
                      <span className="text-white/40 text-xs">•</span>
                      <span className="text-white/40 text-xs">
                        {formatDate(post.published_at || post.created_at)}
                      </span>
                      {post.is_pinned && (
                        <>
                          <span className="text-white/40 text-xs">•</span>
                          <Badge variant="outline" className="bg-white/10 text-white/70 border-white/20">
                            <Pin className="h-3 w-3 mr-1" />
                            Pinned
                          </Badge>
                        </>
                      )}
                    </div>
                    
                    {/* Content Preview */}
                    <p className="text-white/80 text-base line-clamp-3 mb-3">
                      {post.content}
                    </p>

                    {/* Post Meta */}
                    <div className="flex items-center gap-4 text-white/40 text-xs">
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        <span>{post.view_count} views</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {sortedPosts.length === 0 && (
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardContent className="p-12 text-center">
              <div className="mx-auto w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-6">
                <FileText className="h-8 w-8 text-white/60" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                No Posts Yet
              </h3>
              <p className="text-white/60 max-w-md mx-auto">
                This community doesn't have any posts yet. Be the first to share something!
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Post Dialog */}
      <CreatePostDialog
        open={createPostOpen}
        onOpenChange={setCreatePostOpen}
        communityId={community.id}
        communitySlug={community.slug}
      />
    </div>
  )
}