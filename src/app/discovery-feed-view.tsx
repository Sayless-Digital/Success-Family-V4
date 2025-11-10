"use client"

import React, { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { Crown, TrendingUp, Clock, Users, Target, Flame, Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PostMediaSlider } from "@/components/post-media-slider"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { cn, formatRelativeTime } from "@/lib/utils"
import { toast } from "sonner"
import type { PostWithAuthor } from "@/types"
import confetti from "canvas-confetti"

const RELATIVE_TIME_REFRESH_INTERVAL = 60_000

type TabValue = "trending" | "popular" | "recent" | "new-creators" | "near-payout"

interface DiscoveryFeedViewProps {
  posts: (PostWithAuthor & {
    discovery_score?: number
    recent_boosts?: number
    author_total_boosts?: number
    is_low_visibility?: boolean
    is_near_payout?: boolean
    points_to_payout?: number
    popular_score?: number
    created_timestamp?: number
    community?: {
      id: string
      name: string
      slug: string
      logo_url?: string | null
    }
  })[]
  currentUserId?: string
  initialRelativeTimes: Record<string, string>
  payoutMinimumPoints: number
}

export default function DiscoveryFeedView({
  posts: initialPosts,
  currentUserId,
  initialRelativeTimes,
  payoutMinimumPoints
}: DiscoveryFeedViewProps) {
  const { user, walletBalance, refreshWalletBalance } = useAuth()
  const [activeTab, setActiveTab] = useState<TabValue>("trending")
  const [posts, setPosts] = useState(initialPosts)
  const [relativeTimes, setRelativeTimes] = useState(initialRelativeTimes)
  const [boostingPosts, setBoostingPosts] = useState<Set<string>>(new Set())
  const [animatingBoosts, setAnimatingBoosts] = useState<Set<string>>(new Set())
  const postIdsRef = React.useRef<Set<string>>(new Set(posts.map(p => p.id)))

  // Update relative times periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      setRelativeTimes(prev => {
        const updated: Record<string, string> = {}
        posts.forEach(post => {
          updated[post.id] = formatRelativeTime(post.published_at || post.created_at, { now })
        })
        return { ...prev, ...updated }
      })
    }, RELATIVE_TIME_REFRESH_INTERVAL)

    return () => clearInterval(interval)
  }, [posts])

  // Sort posts based on active tab
  const sortedPosts = useMemo(() => {
    const postsCopy = [...posts]
    
    switch (activeTab) {
      case "trending":
        return postsCopy.sort((a, b) => (b.discovery_score || 0) - (a.discovery_score || 0))
      case "popular":
        return postsCopy.sort((a, b) => (b.popular_score || b.boost_count || 0) - (a.popular_score || a.boost_count || 0))
      case "recent":
        return postsCopy.sort((a, b) => (b.created_timestamp || new Date(b.published_at || b.created_at).getTime()) - (a.created_timestamp || new Date(a.published_at || a.created_at).getTime()))
      case "new-creators":
        return postsCopy
          .filter(p => p.is_low_visibility)
          .sort((a, b) => (b.created_timestamp || new Date(b.published_at || b.created_at).getTime()) - (a.created_timestamp || new Date(a.published_at || a.created_at).getTime()))
      case "near-payout":
        return postsCopy
          .filter(p => p.is_near_payout)
          .sort((a, b) => (a.points_to_payout || Infinity) - (b.points_to_payout || Infinity))
      default:
        return postsCopy
    }
  }, [posts, activeTab])

  // Limit to top 50 posts per tab
  const displayPosts = useMemo(() => {
    return sortedPosts.slice(0, 50)
  }, [sortedPosts])

  // Handle boost toggle
  const handleBoostToggle = async (postId: string, authorId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!user) {
      toast.error("Please sign in to boost posts")
      return
    }

    if (walletBalance === null || walletBalance < 1) {
      toast.error("Insufficient points to boost. Please top up your wallet.")
      return
    }

    const post = posts.find(p => p.id === postId)
    if (!post) return

    const wasBoosted = post.user_has_boosted
    const previousBoostCount = post.boost_count || 0

    // Optimistic update
    setBoostingPosts(prev => new Set(prev).add(postId))
    setAnimatingBoosts(prev => new Set(prev).add(postId))
    
    setPosts(prevPosts =>
      prevPosts.map(p => {
        if (p.id !== postId) return p
        return {
          ...p,
          user_has_boosted: !wasBoosted,
          boost_count: wasBoosted ? previousBoostCount - 1 : previousBoostCount + 1,
          can_unboost: !wasBoosted
        }
      })
    )

    try {
      const rpcFunction = wasBoosted ? 'unboost_post' : 'boost_post'
      const { data, error } = await supabase.rpc(rpcFunction, {
        p_post_id: postId,
        p_user_id: user.id
      })

      if (error) throw error

      // Refresh wallet balance
      await refreshWalletBalance()

      // Show success message
      if (wasBoosted) {
        toast.error("💔 Boost removed... They'll miss your support")
      } else {
        toast.success("🚀 Creator boosted! You made their day!")
        // Confetti effect
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 }
        })
      }
    } catch (error: any) {
      console.error('Error toggling boost:', error)
      
      // Revert optimistic update
      setPosts(prevPosts =>
        prevPosts.map(p => {
          if (p.id !== postId) return p
          return {
            ...p,
            user_has_boosted: wasBoosted,
            boost_count: previousBoostCount,
            can_unboost: wasBoosted
          }
        })
      )
      
      toast.error(error?.message || "Failed to boost post. Please try again.")
    } finally {
      setBoostingPosts(prev => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })
      setTimeout(() => {
        setAnimatingBoosts(prev => {
          const next = new Set(prev)
          next.delete(postId)
          return next
        })
      }, 1000)
    }
  }

  // Update postIds ref when posts change
  useEffect(() => {
    postIdsRef.current = new Set(posts.map(p => p.id))
  }, [posts])

  // Realtime subscription for boost updates
  useEffect(() => {
    if (!posts.length) return

    // Subscribe to all post_boosts changes and filter in handler
    const channel = supabase
      .channel('discovery-boosts')
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'post_boosts'
        },
        async (payload: any) => {
          const postId = payload.new?.post_id || payload.old?.post_id
          if (!postId || !postIdsRef.current.has(postId)) return

          // Fetch updated boost count
          const { data: count } = await supabase.rpc('get_post_boost_count', { p_post_id: postId })
          
          if (count !== null) {
            setPosts(prevPosts =>
              prevPosts.map(p => {
                if (p.id !== postId) return p
                return { ...p, boost_count: count }
              })
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [posts])

  // Empty state
  if (displayPosts.length === 0) {
    return (
      <div className="relative w-full overflow-x-hidden">
        <div className="relative z-10 space-y-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="trending">
                <TrendingUp className="h-4 w-4 mr-2" />
                Trending
              </TabsTrigger>
              <TabsTrigger value="popular">
                <Crown className="h-4 w-4 mr-2" />
                Popular
              </TabsTrigger>
              <TabsTrigger value="recent">
                <Clock className="h-4 w-4 mr-2" />
                Recent
              </TabsTrigger>
              <TabsTrigger value="new-creators">
                <Sparkles className="h-4 w-4 mr-2" />
                New Creators
              </TabsTrigger>
              <TabsTrigger value="near-payout">
                <Target className="h-4 w-4 mr-2" />
                Near Payout
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="text-center py-12">
            <p className="text-white/60 text-lg">No posts found in this view</p>
            <p className="text-white/40 text-sm mt-2">Check back later or explore other tabs</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="trending">
              <TrendingUp className="h-4 w-4 mr-2" />
              Trending
            </TabsTrigger>
            <TabsTrigger value="popular">
              <Crown className="h-4 w-4 mr-2" />
              Popular
            </TabsTrigger>
            <TabsTrigger value="recent">
              <Clock className="h-4 w-4 mr-2" />
              Recent
            </TabsTrigger>
            <TabsTrigger value="new-creators">
              <Sparkles className="h-4 w-4 mr-2" />
              New Creators
            </TabsTrigger>
            <TabsTrigger value="near-payout">
              <Target className="h-4 w-4 mr-2" />
              Near Payout
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <div className="space-y-4">
              {displayPosts.map((post) => {
                const community = post.community || (post as any).communities
                
                return (
                  <Card
                    key={post.id}
                    className="group bg-white/10 backdrop-blur-md border-0 hover:bg-white/15 transition-colors"
                  >
                    <CardContent className="p-3">
                      {/* Post Header */}
                      <div className="flex gap-4 mb-3">
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
                        <div className="flex items-start gap-2 flex-1">
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white/80 text-sm font-medium">
                                {post.author.first_name} {post.author.last_name}
                              </span>
                              {post.is_low_visibility && (
                                <Badge variant="outline" className="bg-white/10 text-white/70 border-white/20 text-xs">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  New Creator
                                </Badge>
                              )}
                              {post.recent_boosts && post.recent_boosts > 0 && (
                                <Badge variant="outline" className="bg-orange-500/20 text-orange-200 border-orange-500/30 text-xs">
                                  <Flame className="h-3 w-3 mr-1" />
                                  Trending
                                </Badge>
                              )}
                              {post.is_near_payout && (
                                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30 text-xs">
                                  <Target className="h-3 w-3 mr-1" />
                                  {post.points_to_payout} pts to payout
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-white/40 text-xs" suppressHydrationWarning>
                                {relativeTimes[post.id] ?? formatRelativeTime(post.published_at || post.created_at)}
                              </span>
                              {community && (
                                <>
                                  <span className="text-white/40 text-xs">•</span>
                                  <Link
                                    href={`/${community.slug}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-white/60 text-xs hover:text-white/80 transition-colors"
                                  >
                                    {community.name}
                                  </Link>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="mb-3">
                        <p className="text-white/80 text-base line-clamp-3">
                          {post.content}
                        </p>

                        {/* Post Media Slider */}
                        {post.media && post.media.length > 0 && (
                          <div className="mt-3">
                            <PostMediaSlider media={post.media} author={post.author} />
                          </div>
                        )}
                      </div>

                      {/* Boost Button */}
                      <div className="flex items-center justify-between gap-4">
                        <button
                          onClick={(e) => handleBoostToggle(post.id, post.author_id, e)}
                          disabled={!user || boostingPosts.has(post.id)}
                          className={cn(
                            "group relative flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                            post.user_has_boosted
                              ? "bg-yellow-400/10 border-yellow-400/40"
                              : "bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30",
                            animatingBoosts.has(post.id) && "animate-boost-pulse"
                          )}
                        >
                          <Crown
                            className={cn(
                              "h-4 w-4 transition-all",
                              post.user_has_boosted
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-white/70 group-hover:text-yellow-400",
                              animatingBoosts.has(post.id) && "animate-boost-icon"
                            )}
                            style={{
                              filter: post.user_has_boosted
                                ? "drop-shadow(0 0 8px rgba(250, 204, 21, 0.6))"
                                : "none",
                            }}
                          />
                          <span
                            className={cn(
                              "text-xs font-medium transition-colors",
                              post.user_has_boosted ? "text-yellow-400" : "text-white/70 group-hover:text-white"
                            )}
                          >
                            {post.user_has_boosted ? "Boosted" : "Boost"}
                          </span>
                          <span
                            className={cn(
                              "text-xs font-semibold transition-colors",
                              post.user_has_boosted ? "text-yellow-400" : "text-white/70 group-hover:text-white",
                              animatingBoosts.has(post.id) && "animate-boost-count"
                            )}
                          >
                            {post.boost_count || 0}
                          </span>
                        </button>

                        {/* View Post Link */}
                        {community && (
                          <Link
                            href={`/${community.slug}/feed`}
                            className="text-white/60 text-xs hover:text-white/80 transition-colors"
                          >
                            View in {community.name} →
                          </Link>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

