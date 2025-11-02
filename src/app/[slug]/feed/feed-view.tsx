"use client"

import React, { useMemo, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { FileText, Pin, Crown, Bookmark, Home, Users, MessageSquare, Shield } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import confetti from "canvas-confetti"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { InlinePostComposer } from "@/components/inline-post-composer"
import { PostMediaSlider } from "@/components/post-media-slider"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
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
  posts: initialPosts,
  isMember,
  currentUserId
}: FeedViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, userProfile, walletBalance } = useAuth()

  // Determine active tab
  const activeTab = pathname === `/${community.slug}/feed` ? "feed" : "home"
  const [posts, setPosts] = useState(initialPosts)
  const [boostingPosts, setBoostingPosts] = useState<Set<string>>(new Set())
  const [savingPosts, setSavingPosts] = useState<Set<string>>(new Set())
  const [topVisiblePostId, setTopVisiblePostId] = useState<string | null>(null)
  const [animatingBoosts, setAnimatingBoosts] = useState<Set<string>>(new Set())
  const [newPostsCount, setNewPostsCount] = useState(0)

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

  // Intersection Observer to track which post is at the top
  React.useEffect(() => {
    if (sortedPosts.length === 0) return

    const findTopPost = () => {
      const postElements = document.querySelectorAll('[data-post-id]')
      if (postElements.length === 0) return

      let closestPost: { element: Element; distance: number } | null = null

      postElements.forEach(el => {
        const rect = el.getBoundingClientRect()
        // Calculate distance from top of viewport (negative means it's above)
        const distanceFromTop = rect.top < 0 ? -rect.top : rect.top
        
        // Find the post that's closest to the top but still visible
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          if (!closestPost || distanceFromTop < closestPost.distance) {
            closestPost = { element: el, distance: distanceFromTop }
          }
        }
      })

      if (closestPost) {
        const postId = closestPost.element.getAttribute('data-post-id')
        if (postId) {
          setTopVisiblePostId(postId)
        }
      }
    }

    // Check on mount and on scroll
    findTopPost()
    
    // Listen for scroll on both window and document.body (OverlayScrollbars compatibility)
    let scrollTimeout: NodeJS.Timeout
    const handleScroll = () => {
      // Debounce to improve performance
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(findTopPost, 10)
    }
    window.addEventListener('scroll', handleScroll, true)
    document.addEventListener('scroll', handleScroll, true)
    
    return () => {
      clearTimeout(scrollTimeout)
      window.removeEventListener('scroll', handleScroll, true)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [sortedPosts])

  // Real-time subscription for boost counts
  React.useEffect(() => {
    if (!community?.id || posts.length === 0) return

    // Capture current user ID at subscription time
    const currentUserId = user?.id
    
    // Helper function to refresh all post boost counts
    const refreshAllBoostCounts = async () => {
      // Get current posts from state using a ref-like pattern
      let currentPosts: typeof posts = []
      setPosts((prev) => {
        currentPosts = prev
        return prev
      })
      
      // Wait a bit for DELETE transaction to commit
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Fetch all counts
      const results = await Promise.all(
        currentPosts.map(async (post) => {
          const { data: count, error } = await supabase.rpc('get_post_boost_count', { p_post_id: post.id })
          return { postId: post.id, count: (!error && count !== null) ? count : post.boost_count }
        })
      )
      
      // Update all posts at once
      setPosts((prevPosts) => {
        return prevPosts.map((p) => {
          const result = results.find((r) => r.postId === p.id)
          if (result && result.count !== p.boost_count) {
            console.log(`🔄 Refreshed boost count for ${p.id}: ${p.boost_count} -> ${result.count}`)
            return { ...p, boost_count: result.count }
          }
          return p
        })
      })
    }
    
    const channel = supabase
      .channel(`post-boosts-${community.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_boosts'
        },
        async (payload) => {
          console.log('🔥 Realtime event:', payload.eventType, 'Post:', (payload.new as any)?.post_id || (payload.old as any)?.post_id, 'User:', (payload.new as any)?.user_id || (payload.old as any)?.user_id)
          console.log('📦 Full payload:', JSON.stringify(payload, null, 2))
          
          // Get post_id and user_id from the event
          const postId = (payload.new as any)?.post_id || (payload.old as any)?.post_id
          const eventUserId = (payload.new as any)?.user_id || (payload.old as any)?.user_id
          
          // Handle DELETE events that don't include old data (RLS/realtime issue)
          if (payload.eventType === 'DELETE' && !postId) {
            console.log('⚠️ DELETE event without post_id - refreshing all post boost counts')
            await refreshAllBoostCounts()
            return
          }
          
          // Only process if we have a post ID
          if (!postId) {
            console.log('⏭️  Skipping update - missing postId')
            return
          }
          
          // For DELETE, add delay to ensure DB transaction commits and count is accurate
          if (payload.eventType === 'DELETE') {
            console.log('⏳ Waiting 200ms for DELETE transaction to commit...')
            await new Promise(resolve => setTimeout(resolve, 200))
          }
          
          // Fetch updated boost count (VOLATILE function ensures fresh data)
          // Retry logic for DELETE events to ensure accurate count
          let count: number | null = null
          let error: any = null
          
          for (let attempt = 0; attempt < (payload.eventType === 'DELETE' ? 3 : 1); attempt++) {
            const result = await supabase.rpc('get_post_boost_count', { p_post_id: postId })
            count = result.data
            error = result.error
            
            console.log(`📊 Fetched boost count for ${postId} (attempt ${attempt + 1}):`, count, error ? `Error: ${error.message}` : '')
            
            if (!error && count !== null) {
              break
            }
            
            // Wait a bit before retrying (only for DELETE)
            if (attempt < 2 && payload.eventType === 'DELETE') {
              await new Promise(resolve => setTimeout(resolve, 100))
            }
          }
          
          if (error) {
            console.error('❌ Error fetching boost count after retries:', error)
            return
          }
          
          if (count === null) {
            console.log('⏭️  Skipping update - count is null after retries')
            return
          }
          
          const isCurrentUser = currentUserId && eventUserId === currentUserId
          console.log('👤 Is current user?', isCurrentUser, 'User ID:', currentUserId, 'Event user:', eventUserId)
          
          // Always update the count - use setPosts to check if post exists and update
          setPosts(prevPosts => {
            // Check if post exists in current feed
            const postExists = prevPosts.some(p => p.id === postId)
            if (!postExists) {
              console.log('⏭️  Skipping update - post not in current feed')
              return prevPosts
            }
            
            // Update the post
            const updated = prevPosts.map(p => {
              if (p.id === postId) {
                console.log('🔄 Updating post', postId, 'from count', p.boost_count, 'to', count, 'eventType:', payload.eventType)
                // If this is the current user's action, update their boost status
                if (isCurrentUser) {
                  console.log('✅ Updating current user boost status:', payload.eventType === 'INSERT' ? 'BOOSTED' : 'UNBOOSTED')
                  return {
                    ...p,
                    boost_count: count,
                    user_has_boosted: payload.eventType === 'INSERT',
                    can_unboost: payload.eventType === 'INSERT'
                  }
                }
                // For other users' actions or when we can't determine user, always update the count
                console.log('👥 Updating count only (other user or unknown)')
                return { ...p, boost_count: count }
              }
              return p
            })
            console.log('📝 State updated successfully')
            return updated
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [community?.id, posts.length, user?.id])

  // Fetch saved status for posts
  React.useEffect(() => {
    if (!user || posts.length === 0) return

    const fetchSavedStatus = async () => {
      const postIds = posts.map(p => p.id)
      
      const { data: savedPostsData } = await supabase
        .from('saved_posts')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postIds)

      if (savedPostsData) {
        const savedPostIds = new Set(savedPostsData.map(sp => sp.post_id))
        setPosts(prevPosts =>
          prevPosts.map(p => ({
            ...p,
            user_has_saved: savedPostIds.has(p.id)
          }))
        )
      }
    }

    fetchSavedStatus()
  }, [user, posts.length])

  // Real-time subscription for new posts
  React.useEffect(() => {
    if (!community?.id) return

    const channel = supabase
      .channel(`posts-${community.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
          filter: `community_id=eq.${community.id}`
        },
        (payload) => {
          // Increment new posts counter
          setNewPostsCount(prev => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [community?.id])

  const loadNewPosts = async () => {
    // Refresh the page to load new posts
    router.refresh()
    setNewPostsCount(0)
  }

  const fireGoldConfetti = (element: HTMLElement | null) => {
    if (!element) return
    
    const rect = element.getBoundingClientRect()
    const x = (rect.left + rect.width / 2) / window.innerWidth
    const y = (rect.top + rect.height / 2) / window.innerHeight

    // Fire confetti from button position
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x, y },
      colors: ['#FFD700', '#FFA500', '#FFFF00', '#FFE55C'], // Gold colors
      ticks: 200,
      gravity: 1.2,
      decay: 0.94,
      startVelocity: 30,
      scalar: 1.2,
    })

    // Add extra sparkle burst
    setTimeout(() => {
      confetti({
        particleCount: 30,
        spread: 100,
        origin: { x, y },
        colors: ['#FFD700', '#FFFF00'],
        ticks: 100,
        gravity: 0.8,
        decay: 0.9,
        startVelocity: 20,
        scalar: 0.8,
      })
    }, 150)
  }

  const handleSaveToggle = async (postId: string) => {
    if (!user) return

    // Prevent multiple simultaneous saves
    if (savingPosts.has(postId)) return

    const post = posts.find(p => p.id === postId)
    if (!post) return

    const wasSaved = post.user_has_saved

    // Optimistic update
    setPosts(prevPosts =>
      prevPosts.map(p =>
        p.id === postId
          ? { ...p, user_has_saved: !wasSaved }
          : p
      )
    )

    setSavingPosts(prev => new Set(prev).add(postId))

    try {
      const { data, error } = await supabase.rpc('toggle_save_post', {
        p_post_id: postId,
        p_user_id: user.id
      })

      if (error) throw error

      // Show success message
      if (wasSaved) {
        toast.success("Bookmark removed")
      } else {
        toast.success("Post saved!")
      }
    } catch (error: any) {
      console.error('Error toggling save:', error)
      
      // Revert optimistic update on error
      setPosts(prevPosts =>
        prevPosts.map(p =>
          p.id === postId
            ? { ...p, user_has_saved: wasSaved }
            : p
        )
      )
      
      toast.error('Failed to save post. Please try again.')
    } finally {
      setSavingPosts(prev => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })
    }
  }

  const handleBoostToggle = async (postId: string, postAuthorId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (!user || !userProfile) return
    
    // Prevent boosting own posts
    if (postAuthorId === user.id) {
      toast.error("You cannot boost your own post")
      return
    }

    // Prevent multiple simultaneous boosts
    if (boostingPosts.has(postId)) return

    const post = posts.find(p => p.id === postId)
    if (!post) return

    const wasBoosted = post.user_has_boosted
    const previousBoostCount = post.boost_count || 0
    const canUnboost = post.can_unboost

    // If trying to unboost, check if allowed
    if (wasBoosted && !canUnboost) {
      toast.error("You can only unboost within 1 minute of boosting")
      return
    }

    // Check wallet balance before boosting
    if (!wasBoosted && (walletBalance === null || walletBalance < 1)) {
      toast.error("You need at least 1 point to boost a post")
      return
    }

    // Fire confetti immediately for boost (not unboost)
    if (!wasBoosted) {
      fireGoldConfetti(event.currentTarget as HTMLElement)
      
      // Add boost animation
      setAnimatingBoosts(prev => new Set(prev).add(postId))
      setTimeout(() => {
        setAnimatingBoosts(prev => {
          const next = new Set(prev)
          next.delete(postId)
          return next
        })
      }, 600)
    }

    // Optimistic update
    setPosts(prevPosts =>
      prevPosts.map(p =>
        p.id === postId
          ? {
              ...p,
              user_has_boosted: !wasBoosted,
              boost_count: wasBoosted ? previousBoostCount - 1 : previousBoostCount + 1,
              can_unboost: !wasBoosted ? true : false
            }
          : p
      )
    )

    setBoostingPosts(prev => new Set(prev).add(postId))

    try {
      // Use separate functions for boost/unboost
      const rpcFunction = wasBoosted ? 'unboost_post' : 'boost_post'
      const { data, error } = await supabase.rpc(rpcFunction, {
        p_post_id: postId,
        p_user_id: user.id
      })

      if (error) throw error

      // Wallet balance and boost counts update automatically via Realtime
      
      // Show success message
      if (wasBoosted) {
        toast.error("💔 Boost removed... They'll miss your support")
      } else {
        toast.success("🚀 Creator boosted! You made their day!")
      }

      // No router.refresh() needed - everything updates via Realtime!
    } catch (error: any) {
      console.error('Error toggling boost:', error)
      
      // Revert optimistic update on error
      setPosts(prevPosts =>
        prevPosts.map(p =>
          p.id === postId
            ? {
                ...p,
                user_has_boosted: wasBoosted,
                boost_count: previousBoostCount,
                can_unboost: canUnboost
              }
            : p
        )
      )
      
      // Show user-friendly error message
      const errorMessage = error?.message || error?.error_description || error?.error || ''
      if (errorMessage.includes('Insufficient balance') || errorMessage.includes('insufficient')) {
        toast.error('You need at least 1 point to boost a post')
      } else if (errorMessage.includes('own post')) {
        toast.error('You cannot boost your own post')
      } else if (errorMessage.includes('already boosted')) {
        toast.error('You have already boosted this post')
      } else if (errorMessage.includes('Cannot unboost after')) {
        toast.error('You can only unboost within 1 minute of boosting')
      } else if (errorMessage) {
        toast.error(`Error: ${errorMessage}`)
      } else {
        toast.error('Failed to boost post. Please try again.')
      }
    } finally {
      setBoostingPosts(prev => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString()
  }

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        {/* Navigation Tabs */}
        <Tabs value={activeTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="home" asChild>
              <Link href={`/${community.slug}`} className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Home
              </Link>
            </TabsTrigger>
            <TabsTrigger value="feed" asChild>
              <Link href={`/${community.slug}/feed`} className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Feed
              </Link>
            </TabsTrigger>
            <TabsTrigger value="members" asChild>
              <Link href={`/${community.slug}/members`} className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Members
              </Link>
            </TabsTrigger>
            {(isMember || currentUserId === community.owner_id) && (
              <TabsTrigger value="settings" asChild>
                <Link href={`/${community.slug}/settings`} className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Settings
                </Link>
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
        {/* New Posts Notification - Sticky at top when visible */}
        {newPostsCount > 0 && (
          <div className="sticky top-14 z-[100] flex justify-center py-2 mb-2">
            <button
              onClick={loadNewPosts}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg hover:bg-primary/90 transition-all animate-bounce text-sm font-medium backdrop-blur-sm border border-white/20"
            >
              {newPostsCount} new {newPostsCount === 1 ? 'post' : 'posts'} - Click to load
            </button>
          </div>
        )}

        {/* Inline Post Composer */}
        {isMember && (
          <InlinePostComposer
            communityId={community.id}
            communitySlug={community.slug}
          />
        )}

        {/* Posts List */}
        <div className="space-y-4">
          {sortedPosts.map((post) => (
            <Card
              key={post.id}
              data-post-id={post.id}
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
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <span className="text-white/80 text-sm font-medium">
                        {post.author.first_name} {post.author.last_name}
                      </span>
                      <span className="text-white/40 text-xs">
                        {formatDate(post.published_at || post.created_at)}
                      </span>
                    </div>
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
                </div>
                
                {/* Content Preview */}
                <p className="text-white/80 text-base line-clamp-3">
                  {post.content}
                </p>

                {/* Post Media Slider */}
                {post.media && post.media.length > 0 && (
                  <PostMediaSlider media={post.media} />
                )}

                {/* Boost and Save Buttons */}
                <div className="flex items-center justify-between gap-4 mt-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleBoostToggle(post.id, post.author_id, e)
                    }}
                    disabled={!user || boostingPosts.has(post.id)}
                    className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      post.user_has_boosted
                        ? 'bg-yellow-400/10 border-yellow-400/40'
                        : `bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30 ${
                            topVisiblePostId === post.id ? 'animate-shimmer' : ''
                          }`
                    } ${animatingBoosts.has(post.id) ? 'animate-boost-pulse' : ''}`}
                  >
                    <Crown
                      className={`h-4 w-4 transition-all ${
                        post.user_has_boosted
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-white/70 group-hover:text-yellow-400'
                      } ${animatingBoosts.has(post.id) ? 'animate-boost-icon' : ''}`}
                      style={{
                        filter: post.user_has_boosted ? 'drop-shadow(0 0 8px rgba(250, 204, 21, 0.6))' : 'none'
                      }}
                    />
                    <span className={`text-xs font-medium transition-colors ${
                      post.user_has_boosted ? 'text-yellow-400' : 'text-white/70 group-hover:text-white'
                    }`}>
                      {post.user_has_boosted ? 'Boosted' : 'Boost Creator'}
                    </span>
                    <span className={`text-xs font-semibold transition-colors ${
                      post.user_has_boosted ? 'text-yellow-400' : 'text-white/70 group-hover:text-white'
                    } ${animatingBoosts.has(post.id) ? 'animate-boost-count' : ''}`}>
                      {post.boost_count || 0}
                    </span>
                  </button>

                  {user && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSaveToggle(post.id)
                      }}
                      disabled={savingPosts.has(post.id)}
                      className={`group relative flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        post.user_has_saved
                          ? 'bg-white/10 border-white/30'
                          : 'bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30'
                      }`}
                    >
                      <Bookmark
                        className={`h-4 w-4 transition-all ${
                          post.user_has_saved
                            ? 'fill-white/80 text-white/80'
                            : 'text-white/70 group-hover:text-white/80'
                        }`}
                      />
                    </button>
                  )}
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
    </div>
  )
}