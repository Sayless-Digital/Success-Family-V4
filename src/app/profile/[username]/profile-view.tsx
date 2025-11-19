"use client"

import React, { useState } from "react"
import { Zap, Pin, Crown, Building2, Bookmark, LayoutGrid, TrendingUp, Loader2, MessageCircle, UserPlus, UserCheck } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { toast } from "sonner"
import confetti from "canvas-confetti"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PostMediaSlider } from "@/components/post-media-slider"
import { supabase } from "@/lib/supabase"
import type { Post, PostMedia, User as UserType } from "@/types"
import Link from "next/link"
import { ScrollToTop } from "@/components/scroll-to-top"
import { LoadingSpinner } from "@/components/loading-spinner"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { CommunityLogo } from "@/components/community-logo"
import { TwemojiText } from "@/components/twemoji-text"

interface User {
  id: string
  username: string
  first_name: string
  last_name: string
  bio?: string
  profile_picture?: string
  role: 'admin' | 'community_owner' | 'user'
  created_at: string
}

interface ProfileViewProps {
  user: User
  ownedCommunitiesCount: number
  memberCommunitiesCount: number
  verifiedPaymentsCount: number
  posts: (Post & { media?: PostMedia[] })[]
  postsHasMore: boolean
  boostedPosts: (Post & { media?: PostMedia[], author?: UserType })[]
  boostedPostsHasMore: boolean
  gotBoostedPosts: (Post & { media?: PostMedia[] })[]
  gotBoostedPostsHasMore: boolean
  savedPosts: (Post & { media?: PostMedia[], author?: UserType })[]
  savedPostsHasMore: boolean
  communities: Array<{
    id: string
    name: string
    slug: string
    description?: string
    is_active: boolean
    created_at: string
    logo_url?: string | null
  }>
}

export default function ProfileView({
  user,
  ownedCommunitiesCount,
  memberCommunitiesCount,
  verifiedPaymentsCount,
  posts: initialPosts,
  postsHasMore: initialPostsHasMore,
  boostedPosts: initialBoostedPosts,
  boostedPostsHasMore: initialBoostedPostsHasMore,
  gotBoostedPosts: initialGotBoostedPosts,
  gotBoostedPostsHasMore: initialGotBoostedPostsHasMore,
  savedPosts: initialSavedPosts,
  savedPostsHasMore: initialSavedPostsHasMore,
  communities,
}: ProfileViewProps) {
  const { user: currentUser, userProfile, walletBalance, walletEarningsBalance } = useAuth()
  const isOwnProfile = currentUser?.id === user.id
  const router = useRouter()
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [posts, setPosts] = useState(initialPosts || [])
  const [postsHasMore, setPostsHasMore] = useState(initialPostsHasMore)
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false)
  const postsLoadMoreRef = React.useRef<HTMLDivElement>(null)
  
  const [boostedPosts, setBoostedPosts] = useState(initialBoostedPosts || [])
  const [boostedPostsHasMore, setBoostedPostsHasMore] = useState(initialBoostedPostsHasMore)
  const [isLoadingMoreBoosted, setIsLoadingMoreBoosted] = useState(false)
  const boostedLoadMoreRef = React.useRef<HTMLDivElement>(null)
  
  const [gotBoostedPosts, setGotBoostedPosts] = useState(initialGotBoostedPosts || [])
  const [gotBoostedPostsHasMore, setGotBoostedPostsHasMore] = useState(initialGotBoostedPostsHasMore)
  const [isLoadingMoreGotBoosted, setIsLoadingMoreGotBoosted] = useState(false)
  const gotBoostedLoadMoreRef = React.useRef<HTMLDivElement>(null)
  
  const [savedPosts, setSavedPosts] = useState(initialSavedPosts || [])
  const [savedPostsHasMore, setSavedPostsHasMore] = useState(initialSavedPostsHasMore)
  const [isLoadingMoreSaved, setIsLoadingMoreSaved] = useState(false)
  const savedLoadMoreRef = React.useRef<HTMLDivElement>(null)
  
  const [savingPosts, setSavingPosts] = useState<Set<string>>(new Set())
  const [boostingPosts, setBoostingPosts] = useState<Set<string>>(new Set())
  const [animatingBoosts, setAnimatingBoosts] = useState<Set<string>>(new Set())
  
  const [activeTab, setActiveTab] = useState("posts")
  const [followStatus, setFollowStatus] = React.useState<{ isFollowing: boolean; isFollowedBy: boolean; isMutual: boolean } | null>(null)
  const [isFollowLoading, setIsFollowLoading] = React.useState(false)
  const [isFollowActionLoading, setIsFollowActionLoading] = React.useState(false)
  const [isMessageLoading, setIsMessageLoading] = React.useState(false)

  // Fetch image URLs for all posts
  React.useEffect(() => {
    const allMedia: PostMedia[] = []
    
    posts.forEach(post => {
      if (post.media) {
        allMedia.push(...post.media)
      }
    })
    
    boostedPosts.forEach(post => {
      if (post.media) {
        allMedia.push(...post.media)
      }
    })
    
    gotBoostedPosts.forEach(post => {
      if (post.media) {
        allMedia.push(...post.media)
      }
    })
    
    savedPosts.forEach(post => {
      if (post.media) {
        allMedia.push(...post.media)
      }
    })

    const fetchUrls = async () => {
      const urls: Record<string, string> = {}
      
      for (const item of allMedia) {
        const { data } = supabase.storage
          .from('post-media')
          .getPublicUrl(item.storage_path)
        
        if (data?.publicUrl) {
          urls[item.id] = data.publicUrl
        }
      }
      
      setImageUrls(urls)
    }

    if (allMedia.length > 0) {
      fetchUrls()
    }
  }, [posts, boostedPosts, gotBoostedPosts, savedPosts])

  // Fetch saved status for posts and ensure savedPosts have the flag
  React.useEffect(() => {
    if (!currentUser || (posts.length === 0 && boostedPosts.length === 0 && gotBoostedPosts.length === 0 && savedPosts.length === 0)) return

    const fetchSavedStatus = async () => {
      const allPosts = [...posts, ...boostedPosts, ...gotBoostedPosts, ...savedPosts]
      const postIds = allPosts.map(p => p.id)
      
      if (postIds.length === 0) return

      const { data: savedPostsData } = await supabase
        .from('saved_posts')
        .select('post_id')
        .eq('user_id', currentUser.id)
        .in('post_id', postIds)

      if (savedPostsData) {
        const savedPostIds = new Set(savedPostsData.map(sp => sp.post_id))
        
        // Update all post lists with saved status
        setPosts(prevPosts =>
          prevPosts.map(p => ({
            ...p,
            user_has_saved: savedPostIds.has(p.id)
          }))
        )
        
        setBoostedPosts(prevPosts =>
          prevPosts.map(p => ({
            ...p,
            user_has_saved: savedPostIds.has(p.id)
          }))
        )
        
        setGotBoostedPosts(prevPosts =>
          prevPosts.map(p => ({
            ...p,
            user_has_saved: savedPostIds.has(p.id)
          }))
        )
        
        // Ensure savedPosts all have user_has_saved: true
        setSavedPosts(prevPosts =>
          prevPosts.map(p => ({
            ...p,
            user_has_saved: true // All posts in savedPosts should be saved
          }))
        )
      }
    }

    fetchSavedStatus()
  }, [currentUser, posts.length, boostedPosts.length, gotBoostedPosts.length, savedPosts.length])

  React.useEffect(() => {
    if (!currentUser || isOwnProfile) return

    let isMounted = true
    const fetchFollowStatus = async () => {
      setIsFollowLoading(true)
      try {
        const response = await fetch(`/api/follows?userId=${user.id}`, { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Failed to fetch follow status")
        }
        const data = await response.json()
        if (isMounted) {
          setFollowStatus(data.status ?? null)
        }
      } catch (error) {
        console.error(error)
        if (isMounted) {
          toast.error("Unable to load follow status right now.")
        }
      } finally {
        if (isMounted) {
          setIsFollowLoading(false)
        }
      }
    }

    fetchFollowStatus()

    return () => {
      isMounted = false
    }
  }, [currentUser, isOwnProfile, user.id])

  const requireAuth = React.useCallback(() => {
    if (!currentUser) {
      router.push("/?signin=1")
      return false
    }
    return true
  }, [currentUser, router])

  const handleFollowToggle = async () => {
    if (!requireAuth() || isOwnProfile) return
    if (isFollowActionLoading) return
    setIsFollowActionLoading(true)
    try {
      const method = followStatus?.isFollowing ? "DELETE" : "POST"
      const response = await fetch("/api/follows", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: user.id }),
      })
      if (!response.ok) {
        throw new Error("Follow action failed")
      }
      const data = await response.json()
      setFollowStatus(data.status ?? followStatus)
    } catch (error) {
      console.error(error)
      toast.error("Unable to update follow right now.")
    } finally {
      setIsFollowActionLoading(false)
    }
  }

  const handleMessage = async () => {
    if (!requireAuth() || isOwnProfile) return
    if (isMessageLoading) return
    setIsMessageLoading(true)
    try {
      const response = await fetch("/api/dm/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerUserId: user.id }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData?.error || "Failed to start conversation"
        throw new Error(errorMessage)
      }
      const data = await response.json()
      const threadId = data?.thread?.id ?? data?.threadId
      router.push(threadId ? `/messages?thread=${threadId}` : "/messages")
    } catch (error) {
      console.error("Error starting conversation:", error)
      const errorMessage = error instanceof Error ? error.message : "Unable to start a conversation right now."
      toast.error(errorMessage)
    } finally {
      setIsMessageLoading(false)
    }
  }

  const followLabel = React.useMemo(() => {
    if (!followStatus) {
      return "Follow"
    }
    if (followStatus.isFollowing) {
      return "Following"
    }
    if (followStatus.isFollowedBy) {
      return "Follow Back"
    }
    return "Follow"
  }, [followStatus])

  const followButtonClasses = React.useMemo(() => {
    const base = "h-10 px-6 rounded-full border bg-white/10 backdrop-blur-md transition-all text-sm font-medium"
    if (followStatus?.isFollowing) {
      return `${base} border-white/30 bg-white/20 text-white hover:bg-white/25 hover:border-white/40`
    }
    return `${base} border-white/20 text-white/80 hover:bg-white/15 hover:border-white/30`
  }, [followStatus])

  const handleSaveToggle = async (postId: string) => {
    if (!currentUser) return

    // Prevent multiple simultaneous saves
    if (savingPosts.has(postId)) return

    // Find post in any of the lists (including savedPosts)
    const allPosts = [...posts, ...boostedPosts, ...gotBoostedPosts, ...savedPosts]
    const post = allPosts.find(p => p.id === postId)
    if (!post) return

    const wasSaved = post.user_has_saved

    // Optimistic update for all lists - ensure we create new array and object references
    // Update posts list
    setPosts(prevPosts => {
      const index = prevPosts.findIndex(p => p.id === postId)
      if (index === -1) return prevPosts // Post not in this list
      const updated = [...prevPosts]
      updated[index] = { ...updated[index], user_has_saved: !wasSaved }
      return updated
    })
    
    // Update boostedPosts list
    setBoostedPosts(prevPosts => {
      const index = prevPosts.findIndex(p => p.id === postId)
      if (index === -1) return prevPosts
      const updated = [...prevPosts]
      updated[index] = { ...updated[index], user_has_saved: !wasSaved }
      return updated
    })
    
    // Update gotBoostedPosts list
    setGotBoostedPosts(prevPosts => {
      const index = prevPosts.findIndex(p => p.id === postId)
      if (index === -1) return prevPosts
      const updated = [...prevPosts]
      updated[index] = { ...updated[index], user_has_saved: !wasSaved }
      return updated
    })
    
    // Update savedPosts list - add if saving, remove if unsaving
    if (!wasSaved) {
      // Saving - add to savedPosts if not already there (prevent duplicates)
      setSavedPosts((prev) => {
        // Check if already exists - if so, just update it
        const existingIndex = prev.findIndex(p => p.id === postId)
        if (existingIndex >= 0) {
          // Already exists, update it
          return prev.map((p, idx) => idx === existingIndex ? { ...post, user_has_saved: true } : p)
        }
        // Not exists, add it
        return [{ ...post, user_has_saved: true }, ...prev]
      })
    } else {
      // Unsaving - remove from savedPosts (remove all duplicates just in case)
      setSavedPosts((prev) => prev.filter(p => p.id !== postId))
    }

    setSavingPosts(prev => new Set(prev).add(postId))

    try {
      const { data, error } = await supabase.rpc('toggle_save_post', {
        p_post_id: postId,
        p_user_id: currentUser.id
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
      const revertPost = (p: typeof post) => p.id === postId ? { ...p, user_has_saved: wasSaved } : p
      setPosts(prevPosts => prevPosts.map(revertPost))
      setBoostedPosts(prevPosts => prevPosts.map(revertPost))
      setGotBoostedPosts(prevPosts => prevPosts.map(revertPost))
      
      // Revert savedPosts list
      if (!wasSaved) {
        // Was saving but failed - remove from savedPosts
        setSavedPosts((prev) => prev.filter(p => p.id !== postId))
      } else {
        // Was unsaving but failed - add back to savedPosts
        setSavedPosts((prev) => {
          if (prev.find(p => p.id === postId)) return prev // Already there
          return [{ ...post, user_has_saved: true }, ...prev]
        })
      }
      
      toast.error('Failed to save post. Please try again.')
    } finally {
      setSavingPosts(prev => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })
    }
  }

  // Fire confetti animation for boost
  const fireGoldConfetti = (element: HTMLElement) => {
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
      zIndex: 10000, // Ensure confetti appears above sidebar (z-9000)
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
        zIndex: 10000, // Ensure confetti appears above sidebar (z-9000)
      })
    }, 150)
  }

  const handleBoostToggle = async (postId: string, postAuthorId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (!currentUser || !userProfile) return
    
    // Prevent multiple simultaneous boosts
    if (boostingPosts.has(postId)) return

    // Find post in any of the lists
    const allPosts = [...posts, ...boostedPosts, ...gotBoostedPosts, ...savedPosts]
    const post = allPosts.find(p => p.id === postId)
    if (!post) return

    const wasBoosted = post.user_has_boosted
    const previousBoostCount = post.boost_count || 0

    // Boosts are now irreversible - prevent unboosting
    if (wasBoosted) {
      toast.error("Boosts are permanent and cannot be reversed")
      return
    }

    // Prevent boosting own posts
    if (postAuthorId === currentUser.id) {
      toast.error("You cannot boost your own post")
      return
    }

    // Check combined balance (wallet + earnings) before boosting
    const availableBalance = (walletBalance ?? 0) + (walletEarningsBalance ?? 0)
    if (availableBalance < 1) {
      toast.error("You need at least 1 point to boost a post")
      return
    }

    // Fire confetti immediately for boost
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

    // Helper function to update a post in a list
    const updatePostInList = (p: typeof post) => {
      if (p.id === postId) {
        return {
          ...p,
          user_has_boosted: true,
          boost_count: previousBoostCount + 1,
          can_unboost: false
        }
      }
      return p
    }

    // Optimistic update for posts list
    setPosts(prevPosts => prevPosts.map(updatePostInList))
    setSavedPosts(prevPosts => prevPosts.map(updatePostInList))
    
    // For boostedPosts, add when boosting
    setBoostedPosts((prev) => {
      // Check if already exists - if so, just update it
      const existingIndex = prev.findIndex(p => p.id === postId)
      if (existingIndex >= 0) {
        // Already exists, update it
        return prev.map((p, idx) => idx === existingIndex ? { ...post, user_has_boosted: true, boost_count: previousBoostCount + 1, can_unboost: false } : p)
      }
      // Not exists, add it
      return [{ ...post, user_has_boosted: true, boost_count: previousBoostCount + 1, can_unboost: false }, ...prev]
    })
    
    // For gotBoostedPosts - handle based on whether this is the profile user's post
    const isProfileUsersPost = post.author_id === user.id
    const newCount = previousBoostCount + 1
    
    if (isProfileUsersPost) {
      if (previousBoostCount === 0) {
        // Add to gotBoostedPosts when going from 0 to 1 (first boost)
        setGotBoostedPosts((prev) => {
          const existingIndex = prev.findIndex(p => p.id === postId)
          if (existingIndex >= 0) {
            return prev.map((p, idx) => idx === existingIndex ? { ...post, boost_count: newCount, user_has_boosted: true, can_unboost: false } : p)
          }
          return [...prev, { ...post, boost_count: newCount, user_has_boosted: true, can_unboost: false }]
        })
      } else {
        // Just update the count
        setGotBoostedPosts(prevPosts => prevPosts.map(updatePostInList))
      }
    } else {
      // Not profile user's post, just update if it exists
      setGotBoostedPosts(prevPosts => prevPosts.map(updatePostInList))
    }

    setBoostingPosts(prev => new Set(prev).add(postId))

    try {
      const { data, error } = await supabase.rpc('boost_post', {
        p_post_id: postId,
        p_user_id: currentUser.id
      })

      if (error) throw error

      toast.success("🚀 Creator boosted! You made their day!")
    } catch (error: any) {
      console.error('Error toggling boost:', error)
      
      // Revert optimistic update on error
      const revertPost = (p: typeof post) => {
        if (p.id === postId) {
          return {
            ...p,
            user_has_boosted: wasBoosted,
            boost_count: previousBoostCount,
            can_unboost: false
          }
        }
        return p
      }
      
      setPosts(prevPosts => prevPosts.map(revertPost))
      setSavedPosts(prevPosts => prevPosts.map(revertPost))
      
      // Revert boostedPosts list - remove if boost failed
      setBoostedPosts((prev) => prev.filter(p => p.id !== postId))
      
      // Revert gotBoostedPosts list if it's the profile user's post
      const isProfileUsersPost = post.author_id === user.id
      if (isProfileUsersPost && previousBoostCount === 0) {
        // Was adding to gotBoostedPosts (first boost) but failed - remove it
        setGotBoostedPosts((prev) => prev.filter(p => p.id !== postId))
      } else {
        // Just revert the count
        setGotBoostedPosts(prevPosts => prevPosts.map(revertPost))
      }
      
      // Show user-friendly error message
      const errorMessage = error?.message || ''
      if (errorMessage.includes('balance') || errorMessage.includes('insufficient')) {
        toast.error("Insufficient points to boost this post")
      } else if (errorMessage.includes('cannot be reversed') || errorMessage.includes('irreversible')) {
        toast.error("Boosts are permanent and cannot be reversed")
      } else {
        toast.error(errorMessage || 'Failed to boost post. Please try again.')
      }
    } finally {
      setBoostingPosts(prev => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })
    }
  }

  // Real-time subscription for boost counts and boost status (all posts)
  // This subscription only handles boost counts and status flags, NOT boostedPosts list management
  React.useEffect(() => {
    if (!user.id) return
    
    const channel = supabase
      .channel(`profile-boosts-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_boosts'
        },
        async (payload) => {
          const postId = (payload.new as any)?.post_id || (payload.old as any)?.post_id
          const eventUserId = (payload.new as any)?.user_id || (payload.old as any)?.user_id
          
          // Handle DELETE events that don't include old data (RLS/realtime issue)
          if (payload.eventType === 'DELETE' && !postId) {
            // Refresh all post boost counts
            await new Promise(resolve => setTimeout(resolve, 200))
            
            const allPostIds = [...posts.map(p => p.id), ...boostedPosts.map(p => p.id), ...gotBoostedPosts.map(p => p.id), ...savedPosts.map(p => p.id)]
            const uniquePostIds = [...new Set(allPostIds)]
            
            const results = await Promise.all(
              uniquePostIds.map(async (id) => {
                const { data: count } = await supabase.rpc('get_post_boost_count', { p_post_id: id })
                return { postId: id, count: count || 0 }
              })
            )
            
            // Update all lists
            setPosts(prev => prev.map(p => {
              const result = results.find(r => r.postId === p.id)
              return result ? { ...p, boost_count: result.count } : p
            }))
            
            setBoostedPosts(prev => prev.map(p => {
              const result = results.find(r => r.postId === p.id)
              return result ? { ...p, boost_count: result.count } : p
            }))
            
            setGotBoostedPosts(prev => prev.filter(p => {
              const result = results.find(r => r.postId === p.id)
              // Remove if count is 0
              return result && result.count > 0
            }).map(p => {
              const result = results.find(r => r.postId === p.id)
              return result ? { ...p, boost_count: result.count } : p
            }))
            
            setSavedPosts(prev => prev.map(p => {
              const result = results.find(r => r.postId === p.id)
              return result ? { ...p, boost_count: result.count } : p
            }))
            
            return
          }
          
          if (!postId) return

          // For DELETE, add delay to ensure DB transaction commits
          if (payload.eventType === 'DELETE') {
            await new Promise(resolve => setTimeout(resolve, 200))
          }

          // Fetch updated boost count
          const { data: count } = await supabase.rpc('get_post_boost_count', { p_post_id: postId })
          
          if (count !== null) {
            // Check if current user boosted/unboosted this post
            const isCurrentUserAction = currentUser && eventUserId === currentUser.id

            // Update boost status in posts, gotBoostedPosts, and savedPosts (NOT boostedPosts - that's handled by user-specific subscription)
            if (isCurrentUserAction) {
              const updateBoostStatus = (p: any) => {
                if (p.id !== postId) {
                  return p
                }

                let userHasBoosted = p.user_has_boosted
                let canUnboost = p.can_unboost

                if (payload.eventType === 'INSERT') {
                  userHasBoosted = true
                  canUnboost = true
                } else if (payload.eventType === 'DELETE') {
                  userHasBoosted = false
                  canUnboost = false
                }

                return {
                  ...p,
                  boost_count: count,
                  user_has_boosted: userHasBoosted,
                  can_unboost: canUnboost
                }
              }

              setPosts((prevPosts) => prevPosts.map(updateBoostStatus))
              setGotBoostedPosts((prevPosts) => prevPosts.map(updateBoostStatus))
              setSavedPosts((prevPosts) => prevPosts.map(updateBoostStatus))
            }

            // Update boost counts in all lists (including boostedPosts)
            // Note: We update counts in boostedPosts but DON'T add/remove posts - that's handled by user-specific subscription
            setPosts((prevPosts) => {
              return prevPosts.map((p) => {
                if (p.id === postId) {
                  return { ...p, boost_count: count }
                }
                return p
              })
            })

            // Update boostedPosts counts (but not add/remove - that's user-specific subscription's job)
            setBoostedPosts((prevPosts) => {
              return prevPosts.map((p) => {
                if (p.id === postId) {
                  return { ...p, boost_count: count }
                }
                return p
              })
            })

            // Update gotBoostedPosts - add/remove based on count
            // Need to fetch post to check if it belongs to profile user
            const updateGotBoostedPosts = async () => {
              // Fetch the post to check author
              const { data: postData } = await supabase
                .from('posts')
                .select('id, author_id, content, created_at, published_at, is_pinned, community_id')
          .eq('depth', 0)
                .eq('id', postId)
                .single()

              if (!postData) return

              const isUsersPost = postData.author_id === user.id

              setGotBoostedPosts((prevGotBoosted) => {
                const existingPost = prevGotBoosted.find(p => p.id === postId)

                if (isUsersPost) {
                  // If post just got its first boost, add it to gotBoostedPosts
                  if (count > 0 && !existingPost) {
                    // Fetch full post with media
                    supabase
                      .from('posts')
                      .select(`
                        *,
                        post_media (*),
                        communities!posts_community_id_fkey (slug, name)
                      `)
                      .eq('depth', 0)
                      .eq('id', postId)
                      .single()
                      .then(({ data }) => {
                        if (data) {
                          const media = (data.post_media || []).sort((a: PostMedia, b: PostMedia) =>
                            a.display_order - b.display_order
                          )
                          const enrichedPost: Post & { media?: PostMedia[] } = {
                            ...data,
                            boost_count: count,
                            media: media.length > 0 ? media : undefined,
                            community_slug: data.communities?.slug,
                            community_name: data.communities?.name
                          }
                          setGotBoostedPosts((prev) => {
                            if (prev.find(p => p.id === postId)) return prev
                            return [...prev, enrichedPost]
                          })
                        }
                      })
                    return prevGotBoosted
                  }

                  // If boost count went to 0, remove from gotBoostedPosts
                  if (count === 0 && existingPost) {
                    return prevGotBoosted.filter(p => p.id !== postId)
                  }

                  // Otherwise, just update the boost count
                  if (existingPost) {
                    return prevGotBoosted.map((p) => {
                      if (p.id === postId) {
                        return { ...p, boost_count: count }
                      }
                      return p
                    })
                  }
                } else {
                  // Post doesn't belong to user, just update boost count if it exists
                  if (existingPost) {
                    // If boost count went to 0, remove from gotBoostedPosts
                    if (count === 0) {
                      return prevGotBoosted.filter(p => p.id !== postId)
                    }

                    // Update the boost count
                    return prevGotBoosted.map((p) => {
                      if (p.id === postId) {
                        return { ...p, boost_count: count }
                      }
                      return p
                    })
                  }
                }

                return prevGotBoosted
              })
            }

            updateGotBoostedPosts()

            // Update in saved posts
            setSavedPosts((prevPosts) => {
              return prevPosts.map((p) => {
                if (p.id === postId) {
                  return { ...p, boost_count: count }
                }
                return p
              })
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user.id, currentUser?.id])

  // Real-time subscription for new posts
  React.useEffect(() => {
    if (!user.id) return

    const channel = supabase
      .channel(`profile-posts-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
          filter: `author_id=eq.${user.id}`
        },
        async (payload) => {
          const newPost = payload.new as any
          if (!newPost) return

          // Fetch the new post with all its data
          const { data: postData } = await supabase
            .from('posts')
            .select(`
              *,
              post_media (*),
              communities!posts_community_id_fkey (slug, name)
            `)
            .eq('id', newPost.id)
            .single()

          if (!postData) return

          // Get boost count
          const { data: boostCount } = await supabase
            .rpc('get_post_boost_count', { p_post_id: newPost.id })

          // Get media sorted by display_order
          const media = (postData.post_media || []).sort((a: PostMedia, b: PostMedia) => 
            a.display_order - b.display_order
          )

          const enrichedPost: Post & { media?: PostMedia[] } = {
            ...postData,
            boost_count: boostCount || 0,
            media: media.length > 0 ? media : undefined,
            community_slug: postData.communities?.slug,
            community_name: postData.communities?.name
          }

          // Add to posts list
          setPosts((prevPosts) => [enrichedPost, ...prevPosts])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user.id])

  // Real-time subscription for saved posts (only for own profile)
  React.useEffect(() => {
    if (!isOwnProfile || !currentUser?.id) return

    const channel = supabase
      .channel(`profile-saved-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_posts',
          filter: `user_id=eq.${currentUser.id}`
        },
        async (payload) => {
          const postId = (payload.new as any)?.post_id || (payload.old as any)?.post_id
          if (!postId) return

          // For DELETE, add delay to ensure DB transaction commits (same as boost subscription)
          if (payload.eventType === 'DELETE') {
            await new Promise(resolve => setTimeout(resolve, 200))
          }

          if (payload.eventType === 'INSERT') {
            // Post was saved - fetch it and add to saved posts
            const { data: savedData } = await supabase
              .from('saved_posts')
              .select(`
                post_id,
                posts (
                  *,
                  post_media (*),
                  author:users!posts_author_id_fkey (*),
                  communities!posts_community_id_fkey (slug, name)
                )
              `)
              .eq('id', payload.new.id)
              .single()

            if (savedData && savedData.posts) {
              const post = savedData.posts as any
              
              // Get boost count
              const { data: boostCount } = await supabase
                .rpc('get_post_boost_count', { p_post_id: post.id })

              // Get media sorted by display_order
              const media = (post.post_media || []).sort((a: PostMedia, b: PostMedia) => 
                a.display_order - b.display_order
              )

              const enrichedPost: Post & { media?: PostMedia[], author?: UserType } = {
                ...post,
                boost_count: boostCount || 0,
                media: media.length > 0 ? media : undefined,
                author: post.author,
                community_slug: post.communities?.slug,
                community_name: post.communities?.name,
                user_has_saved: true
              }

              // Only add to savedPosts if not already there (prevent duplicates from realtime + optimistic)
              setSavedPosts((prev) => {
                if (prev.find(p => p.id === postId)) {
                  // Already exists, just update it
                  return prev.map(p => p.id === postId ? enrichedPost : p)
                }
                return [enrichedPost, ...prev]
              })

              // Update saved status in all post lists
              const updateSaved = (p: any) => {
                if (p.id === postId) {
                  return { ...p, user_has_saved: true }
                }
                return p
              }
              
              setPosts((prev) => {
                const hasPost = prev.some(p => p.id === postId)
                if (!hasPost) return prev
                const updated = prev.map(updateSaved)
                return updated.some((p, i) => p !== prev[i]) ? updated : prev
              })
              
              setBoostedPosts((prev) => {
                const hasPost = prev.some(p => p.id === postId)
                if (!hasPost) return prev
                const updated = prev.map(updateSaved)
                return updated.some((p, i) => p !== prev[i]) ? updated : prev
              })
              
              setGotBoostedPosts((prev) => {
                const hasPost = prev.some(p => p.id === postId)
                if (!hasPost) return prev
                const updated = prev.map(updateSaved)
                return updated.some((p, i) => p !== prev[i]) ? updated : prev
              })
            }
          } else if (payload.eventType === 'DELETE') {
            // Post was unsaved - remove from saved posts
            setSavedPosts((prev) => prev.filter(p => p.id !== postId))

            // Update saved status in all post lists (ensure it's set to false)
            // Use a more explicit update function to ensure state changes are detected
            const updateUnsaved = (p: any) => {
              if (p.id === postId) {
                return { ...p, user_has_saved: false }
              }
              return p
            }
            
            setPosts((prev) => {
              const hasPost = prev.some(p => p.id === postId)
              if (!hasPost) return prev // Don't create empty updates
              const updated = prev.map(updateUnsaved)
              // Force a new array reference to ensure React detects the change
              return updated.some((p, i) => p !== prev[i]) ? updated : prev
            })
            
            setBoostedPosts((prev) => {
              const hasPost = prev.some(p => p.id === postId)
              if (!hasPost) return prev
              const updated = prev.map(updateUnsaved)
              return updated.some((p, i) => p !== prev[i]) ? updated : prev
            })
            
            setGotBoostedPosts((prev) => {
              const hasPost = prev.some(p => p.id === postId)
              if (!hasPost) return prev
              const updated = prev.map(updateUnsaved)
              return updated.some((p, i) => p !== prev[i]) ? updated : prev
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOwnProfile, currentUser?.id])

  // Real-time subscription for boosted posts (only for own profile) - handles adding posts when boosted
  React.useEffect(() => {
    if (!isOwnProfile || !currentUser?.id) return

    const channel = supabase
      .channel(`profile-boosted-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_boosts',
          filter: `user_id=eq.${currentUser.id}`
        },
        async (payload) => {
          const postId = (payload.new as any)?.post_id || (payload.old as any)?.post_id
          if (!postId) return

          // For DELETE, add delay to ensure DB transaction commits
          if (payload.eventType === 'DELETE') {
            await new Promise(resolve => setTimeout(resolve, 200))
            
            // Get updated boost count
            const { data: boostCount } = await supabase
              .rpc('get_post_boost_count', { p_post_id: postId })
            
            const newCount = boostCount || 0
            
            // Remove from boostedPosts - this subscription handles the removal
            setBoostedPosts((prev) => {
              const filtered = prev.filter(p => p.id !== postId)
              return filtered
            })
            
            // Update user_has_boosted status and boost count in other lists
            const updateUnboosted = (p: any) => {
              if (p.id === postId) {
                return { 
                  ...p, 
                  user_has_boosted: false, 
                  can_unboost: false,
                  boost_count: newCount
                }
              }
              return p
            }
            
            setPosts((prev) => {
              const updated = prev.map(updateUnboosted)
              return updated.some((p, i) => p !== prev[i]) ? updated : prev
            })
            
            setGotBoostedPosts((prev) => {
              const updated = prev.map(updateUnboosted)
              return updated.some((p, i) => p !== prev[i]) ? updated : prev
            })
            
            setSavedPosts((prev) => {
              const updated = prev.map(updateUnboosted)
              return updated.some((p, i) => p !== prev[i]) ? updated : prev
            })
            
            return
          }

          if (payload.eventType === 'INSERT') {
            // Post was boosted - fetch it and add to boosted posts
            const { data: boostData } = await supabase
              .from('post_boosts')
              .select(`
                post_id,
                posts (
                  *,
                  post_media (*),
                  author:users!posts_author_id_fkey (*),
                  communities!posts_community_id_fkey (slug, name)
                )
              `)
              .eq('id', payload.new.id)
              .single()

            if (boostData && boostData.posts) {
              if ((boostData.posts as any)?.depth && (boostData.posts as any).depth > 0) {
                return
              }
              const post = boostData.posts as any
              
              // Get boost count
              const { data: boostCount } = await supabase
                .rpc('get_post_boost_count', { p_post_id: post.id })

              // Get media sorted by display_order
              const media = (post.post_media || []).sort((a: PostMedia, b: PostMedia) => 
                a.display_order - b.display_order
              )

              // Check if user can unboost (within 1 minute)
              const { data: canUnboost } = await supabase
                .rpc('can_unboost_post', {
                  p_post_id: post.id,
                  p_user_id: currentUser.id
                })

              const enrichedPost: Post & { media?: PostMedia[], author?: UserType } = {
                ...post,
                boost_count: boostCount || 0,
                media: media.length > 0 ? media : undefined,
                author: post.author,
                community_slug: post.communities?.slug,
                community_name: post.communities?.name,
                user_has_boosted: true,
                can_unboost: canUnboost || false
              }

              // Only add to boostedPosts if not already there (prevent duplicates)
              setBoostedPosts((prev) => {
                if (prev.find(p => p.id === postId)) {
                  // Already exists, just update it
                  return prev.map(p => p.id === postId ? enrichedPost : p)
                }
                return [enrichedPost, ...prev]
              })
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOwnProfile, currentUser?.id])

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

  // Helper function to enrich posts with batch queries
  const enrichPostsBatch = async (newPosts: any[]) => {
    if (!newPosts || newPosts.length === 0) return []
    
    const postIds = newPosts.map(p => p.id)
    
    // Batch fetch boost counts
    const { data: boostCountsData } = await supabase
      .rpc('get_posts_boost_counts', { p_post_ids: postIds })

    // Batch fetch user boost status if authenticated
    let userBoostStatus: Array<{ post_id: string; user_has_boosted: boolean; can_unboost: boolean }> = []
    if (currentUser) {
      const { data: boostStatusData } = await supabase
        .rpc('get_user_boosted_posts', { 
          p_post_ids: postIds,
          p_user_id: currentUser.id 
        })
      userBoostStatus = boostStatusData || []
    }

    // Create lookup maps
    const boostCountMap = new Map(
      (boostCountsData || []).map((b: { post_id: string; boost_count: number }) => [b.post_id, b.boost_count])
    )
    const boostStatusMap = new Map(
      userBoostStatus.map((b: { post_id: string; user_has_boosted: boolean; can_unboost: boolean }) => [b.post_id, { user_has_boosted: b.user_has_boosted, can_unboost: b.can_unboost }])
    )

    // Enrich posts
    return newPosts.map((post: any) => {
      const boostCount = boostCountMap.get(post.id) || 0
      const boostStatus = boostStatusMap.get(post.id) || { user_has_boosted: false, can_unboost: false }
      
      const media = (post.post_media || []).sort((a: PostMedia, b: PostMedia) => 
        a.display_order - b.display_order
      )

      return {
        ...post,
        boost_count: boostCount,
        media: media.length > 0 ? media : undefined,
        community_slug: post.communities?.slug,
        community_name: post.communities?.name,
        user_has_boosted: boostStatus.user_has_boosted,
        can_unboost: boostStatus.can_unboost
      }
    })
  }

  // Load more functions for each tab
  const loadMorePosts = async () => {
    if (isLoadingMorePosts || !postsHasMore || posts.length === 0) return
    setIsLoadingMorePosts(true)
    
    try {
      const lastPost = posts[posts.length - 1]
      const lastPostDate = lastPost?.published_at || lastPost?.created_at

      const { data: newPostsData, error } = await supabase
        .from('posts')
        .select(`
          *,
          post_media (*),
          communities!posts_community_id_fkey (slug, name)
        `)
        .eq('author_id', user.id)
        .eq('depth', 0)
        .order('created_at', { ascending: false })
        .lt('created_at', lastPostDate || new Date().toISOString())
        .limit(20)

      if (error) throw error
      if (!newPostsData || newPostsData.length === 0) {
        setPostsHasMore(false)
        return
      }

      const enriched = await enrichPostsBatch(newPostsData)
      setPosts(prev => [...prev, ...enriched])
      if (enriched.length < 20) setPostsHasMore(false)
    } catch (error: any) {
      console.error('Error loading more posts:', error)
      toast.error('Failed to load more posts')
    } finally {
      setIsLoadingMorePosts(false)
    }
  }

  const loadMoreBoosted = async () => {
    if (isLoadingMoreBoosted || !boostedPostsHasMore || boostedPosts.length === 0) return
    setIsLoadingMoreBoosted(true)
    
    try {
      const lastBoost = boostedPosts[boostedPosts.length - 1]
      const lastBoostDate = lastBoost?.created_at

      const { data: newBoostedData, error } = await supabase
        .from('post_boosts')
        .select(`
          post_id,
          posts (
            *,
            post_media (*),
            author:users!posts_author_id_fkey (*),
            communities!posts_community_id_fkey (slug, name)
          )
        `)
        .eq('user_id', user.id)
        .eq('posts.depth', 0)
        .order('created_at', { ascending: false })
        .lt('created_at', lastBoostDate || new Date().toISOString())
        .limit(20)

      if (error) throw error
      if (!newBoostedData || newBoostedData.length === 0) {
        setBoostedPostsHasMore(false)
        return
      }

      const newPostsRaw = newBoostedData
        .filter((boost: any) => boost.posts)
        .map((boost: any) => ({
          ...boost.posts,
          post_media: boost.posts.post_media || [],
          communities: boost.posts.communities,
          author: boost.posts.author
        }))

      const enriched = await enrichPostsBatch(newPostsRaw)
      const withBoostStatus = enriched.map((post: any) => ({
        ...post,
        user_has_boosted: true,
        author: newPostsRaw.find((p: any) => p.id === post.id)?.author
      }))
      
      setBoostedPosts(prev => [...prev, ...withBoostStatus])
      if (withBoostStatus.length < 20) setBoostedPostsHasMore(false)
    } catch (error: any) {
      console.error('Error loading more boosted posts:', error)
      toast.error('Failed to load more posts')
    } finally {
      setIsLoadingMoreBoosted(false)
    }
  }

  const loadMoreGotBoosted = async () => {
    if (isLoadingMoreGotBoosted || !gotBoostedPostsHasMore || gotBoostedPosts.length === 0) return
    setIsLoadingMoreGotBoosted(true)
    
    try {
      const lastPost = gotBoostedPosts[gotBoostedPosts.length - 1]
      const lastPostDate = lastPost?.published_at || lastPost?.created_at

      const { data: newPostsData, error } = await supabase
        .from('posts')
        .select(`
          *,
          post_media (*),
          communities!posts_community_id_fkey (slug, name),
          post_boosts!inner(post_id)
        `)
        .eq('author_id', user.id)
        .eq('depth', 0)
        .order('created_at', { ascending: false })
        .lt('created_at', lastPostDate || new Date().toISOString())
        .limit(100)

      if (error) throw error
      if (!newPostsData || newPostsData.length === 0) {
        setGotBoostedPostsHasMore(false)
        return
      }

      const uniquePosts = Array.from(
        new Map(newPostsData.map((p: any) => [p.id, p])).values()
      ).slice(0, 20)

      const enriched = await enrichPostsBatch(uniquePosts)
      const filtered = enriched.filter((p: any) => (p.boost_count || 0) > 0)
      
      setGotBoostedPosts(prev => [...prev, ...filtered])
      if (filtered.length < 20) setGotBoostedPostsHasMore(false)
    } catch (error: any) {
      console.error('Error loading more got boosted posts:', error)
      toast.error('Failed to load more posts')
    } finally {
      setIsLoadingMoreGotBoosted(false)
    }
  }

  const loadMoreSaved = async () => {
    if (isLoadingMoreSaved || !savedPostsHasMore || savedPosts.length === 0) return
    setIsLoadingMoreSaved(true)
    
    try {
      const lastSaved = savedPosts[savedPosts.length - 1]
      const lastSavedDate = lastSaved?.created_at

      const { data: newSavedData, error } = await supabase
        .from('saved_posts')
        .select(`
          post_id,
          posts (
            *,
            post_media (*),
            author:users!posts_author_id_fkey (*),
            communities!posts_community_id_fkey (slug, name)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .lt('created_at', lastSavedDate || new Date().toISOString())
        .limit(20)

      if (error) throw error
      if (!newSavedData || newSavedData.length === 0) {
        setSavedPostsHasMore(false)
        return
      }

      const newPostsRaw = newSavedData
        .filter((saved: any) => saved.posts)
        .map((saved: any) => ({
          ...saved.posts,
          post_media: saved.posts.post_media || [],
          communities: saved.posts.communities,
          author: saved.posts.author
        }))

      const enriched = await enrichPostsBatch(newPostsRaw)
      const withSavedFlag = enriched.map((post: any) => ({
        ...post,
        user_has_saved: true,
        author: newPostsRaw.find((p: any) => p.id === post.id)?.author
      }))
      
      setSavedPosts(prev => [...prev, ...withSavedFlag])
      if (withSavedFlag.length < 20) setSavedPostsHasMore(false)
    } catch (error: any) {
      console.error('Error loading more saved posts:', error)
      toast.error('Failed to load more posts')
    } finally {
      setIsLoadingMoreSaved(false)
    }
  }

  // Intersection Observers for infinite scroll on each tab
  React.useEffect(() => {
    if (!postsHasMore || isLoadingMorePosts || activeTab !== "posts") return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMorePosts()
      },
      { root: null, rootMargin: '200px', threshold: 0.1 }
    )

    if (postsLoadMoreRef.current) observer.observe(postsLoadMoreRef.current)
    return () => {
      if (postsLoadMoreRef.current) observer.unobserve(postsLoadMoreRef.current)
    }
  }, [postsHasMore, isLoadingMorePosts, activeTab, posts.length])

  React.useEffect(() => {
    if (!boostedPostsHasMore || isLoadingMoreBoosted || activeTab !== "boosts") return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreBoosted()
      },
      { root: null, rootMargin: '200px', threshold: 0.1 }
    )

    if (boostedLoadMoreRef.current) observer.observe(boostedLoadMoreRef.current)
    return () => {
      if (boostedLoadMoreRef.current) observer.unobserve(boostedLoadMoreRef.current)
    }
  }, [boostedPostsHasMore, isLoadingMoreBoosted, activeTab, boostedPosts.length])

  React.useEffect(() => {
    if (!gotBoostedPostsHasMore || isLoadingMoreGotBoosted || activeTab !== "got-boosted") return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreGotBoosted()
      },
      { root: null, rootMargin: '200px', threshold: 0.1 }
    )

    if (gotBoostedLoadMoreRef.current) observer.observe(gotBoostedLoadMoreRef.current)
    return () => {
      if (gotBoostedLoadMoreRef.current) observer.unobserve(gotBoostedLoadMoreRef.current)
    }
  }, [gotBoostedPostsHasMore, isLoadingMoreGotBoosted, activeTab, gotBoostedPosts.length])

  React.useEffect(() => {
    if (!savedPostsHasMore || isLoadingMoreSaved || activeTab !== "saved") return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreSaved()
      },
      { root: null, rootMargin: '200px', threshold: 0.1 }
    )

    if (savedLoadMoreRef.current) observer.observe(savedLoadMoreRef.current)
    return () => {
      if (savedLoadMoreRef.current) observer.unobserve(savedLoadMoreRef.current)
    }
  }, [savedPostsHasMore, isLoadingMoreSaved, activeTab, savedPosts.length])

  const PostList = ({ postsToShow, hasMore, isLoadingMore, loadMoreRef: ref }: { 
    postsToShow: (Post & { media?: PostMedia[], author?: UserType })[]
    hasMore?: boolean
    isLoadingMore?: boolean
    loadMoreRef?: React.RefObject<HTMLDivElement | null>
  }) => {
    if (!postsToShow || postsToShow.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-white/60">No posts yet</p>
        </div>
      )
    }

    // Remove duplicates by ID (keep first occurrence)
    const uniquePosts = postsToShow.filter((post, index, self) => 
      index === self.findIndex((p) => p.id === post.id)
    )

    // Sort posts: pinned first, then by date
    const sortedPosts = [...uniquePosts].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1
      if (!a.is_pinned && b.is_pinned) return 1
      
      const dateA = new Date(a.published_at || a.created_at).getTime()
      const dateB = new Date(b.published_at || b.created_at).getTime()
      return dateB - dateA
    })

    return (
      <div className="flex flex-col gap-4">
        {sortedPosts.map((post) => {
          // For user's own posts, use the profile user; for boosted posts, use the author
          const postAuthor = post.author || {
            id: user.id,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            profile_picture: user.profile_picture,
            bio: user.bio
          }
          const communitySlug = (post as any).community_slug
          const postLink = communitySlug ? `/${communitySlug}/feed#post-${post.id}` : '#'

          return (
            <Card 
              key={post.id}
              className="group bg-white/10 backdrop-blur-md border-0 hover:bg-white/15 transition-colors"
            >
              <CardContent className="p-3">
                {/* Post Header */}
                <div className="flex gap-4 mb-3">
                  {/* Author Avatar */}
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0 avatar-feedback"
                  >
                    <Avatar 
                      className="h-10 w-10 border-4 border-white/20" 
                      userId={postAuthor?.id}
                      showHoverCard={true}
                      username={postAuthor?.username}
                      firstName={postAuthor?.first_name}
                      lastName={postAuthor?.last_name}
                      profilePicture={postAuthor?.profile_picture}
                      bio={postAuthor?.bio}
                    >
                      <AvatarImage 
                        src={postAuthor?.profile_picture} 
                        alt={`${postAuthor?.first_name} ${postAuthor?.last_name}`} 
                      />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm">
                        {postAuthor?.first_name?.[0] || ''}{postAuthor?.last_name?.[0] || ''}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                    {/* Post Info */}
                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex flex-col">
                        <span className="text-white/80 text-sm font-medium">
                          {postAuthor?.first_name} {postAuthor?.last_name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-white/40 text-xs">
                            {formatDate(post.published_at || post.created_at)}
                          </span>
                          {communitySlug && (post as any).community_name && (
                            <>
                              <span className="text-white/40 text-xs">•</span>
                              <Link 
                                href={`/${communitySlug}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-white/60 hover:text-white/80 text-xs transition-colors touch-feedback"
                                prefetch={true}
                              >
                                {(post as any).community_name}
                              </Link>
                            </>
                          )}
                        </div>
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
                  
                  {/* Tags - Below Header, Above Content */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {(post as any).is_trending && (
                      <Badge variant="outline" className="bg-white/10 text-white/70 border-white/20">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Trending
                      </Badge>
                    )}
                    {post.boost_reward_message && (
                      <Badge 
                        variant="outline" 
                        className="text-white border-yellow-400/50 relative overflow-hidden"
                        style={{
                          background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #9333EA 100%)',
                          boxShadow: '0 0 10px rgba(255, 215, 0, 0.5), 0 0 20px rgba(147, 51, 234, 0.3)',
                        }}
                      >
                        <Crown className="h-3 w-3 mr-1 relative z-10 drop-shadow-lg" />
                        <span className="relative z-10 drop-shadow-lg font-semibold">Boost for Reward</span>
                      </Badge>
                    )}
                  </div>

                  {/* Content */}
                  <p className="text-white/80 text-base mb-3 whitespace-pre-wrap break-words">
                    <TwemojiText text={post.content} size={20} />
                  </p>

                  {/* Post Media Slider */}
                  {post.media && post.media.length > 0 && (
                    <PostMediaSlider 
                      media={post.media} 
                      author={post.author}
                      userHasBoosted={post.user_has_boosted || false}
                      authorId={post.author_id}
                      currentUserId={currentUser?.id}
                    />
                  )}

                  {/* Boost to unlock reward message */}
                  {post.media?.some(m => m.media_type === 'audio' && m.requires_boost && !post.user_has_boosted && post.author_id !== currentUser?.id) && (
                    <div className="mt-3 text-center">
                      <p className="text-sm text-white/70">Boost to unlock reward</p>
                    </div>
                  )}

                  {/* Boost and Save Buttons */}
                  <div className="flex items-center justify-between gap-4 mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleBoostToggle(post.id, post.author_id, e)
                      }}
                      disabled={!currentUser || boostingPosts.has(post.id) || post.user_has_boosted}
                      className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed touch-feedback ${
                        post.user_has_boosted
                          ? 'bg-yellow-400/10 border-yellow-400/40'
                          : 'bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30'
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

                    {currentUser && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSaveToggle(post.id)
                        }}
                        disabled={savingPosts.has(post.id)}
                        className={`group relative flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed touch-feedback ${
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
          )
        })}
        
        {/* Infinite Scroll Trigger & Loading Indicator */}
        {sortedPosts.length > 0 && (
          <div ref={ref} className="py-8 flex justify-center">
            {isLoadingMore && (
              <div className="flex flex-col items-center gap-4">
                <LoadingSpinner />
                <p className="text-white/60 text-sm">Loading more posts...</p>
              </div>
            )}
            {!hasMore && !isLoadingMore && (
              <p className="text-white/60 text-sm">No more posts to load</p>
            )}
          </div>
        )}
      </div>
    )
  }


  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        {/* Profile Header - TikTok Style */}
        <div className="mb-6 mt-2">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="mb-2">
              <Avatar className="h-24 w-24 border-4 border-white/20" userId={user.id}>
                  <AvatarImage src={user.profile_picture || ''} alt={user.username} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-3xl">
                    {user.first_name?.[0] || ''}
                    {user.last_name?.[0] || ''}
                  </AvatarFallback>
              </Avatar>
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-1">
                  {user.first_name} {user.last_name}
            </h1>
            
            <p className="text-white/70 text-sm mb-1">@{user.username}</p>
            
                {user.bio && (
              <p className="text-white/80 text-sm max-w-md mx-auto mt-2">
                    {user.bio}
                  </p>
                )}
            {!isOwnProfile && (
              <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
                <Button
                  onClick={handleFollowToggle}
                  disabled={isFollowLoading || isFollowActionLoading}
                  className={followButtonClasses}
                >
                  {isFollowActionLoading || isFollowLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : followStatus?.isFollowing ? (
                    <span className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      Following
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      {followLabel}
                    </span>
                  )}
                </Button>
                <Button
                  onClick={handleMessage}
                  disabled={isMessageLoading}
                  className="h-10 px-6 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-white/80 hover:bg-white/15 hover:border-white/30 text-sm font-medium transition-all"
                >
                  {isMessageLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Message
                    </span>
                  )}
                </Button>
                {followStatus?.isMutual && (
                  <Badge className="bg-white/15 text-white/80 border-white/30">Mutual Follow</Badge>
                )}
              </div>
            )}
              </div>

        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="posts" className="gap-2 touch-feedback">
              <LayoutGrid className="h-4 w-4" />
              <span>All Posts ({posts.length})</span>
            </TabsTrigger>
            {isOwnProfile && (
              <>
                <TabsTrigger value="boosts" className="gap-2 touch-feedback">
                  <Zap className="h-4 w-4" />
                  <span>I Boosted ({boostedPosts.length})</span>
                </TabsTrigger>
                <TabsTrigger value="saved" className="gap-2 touch-feedback">
                  <Bookmark className="h-4 w-4" />
                  <span>Saved ({savedPosts.length})</span>
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="got-boosted" className="gap-2 touch-feedback">
              <TrendingUp className="h-4 w-4" />
              <span>Got Boosted ({gotBoostedPosts.length})</span>
            </TabsTrigger>
            <TabsTrigger value="communities" className="gap-2 touch-feedback">
              <Building2 className="h-4 w-4" />
              <span>Communities ({communities.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-4">
            <PostList 
              postsToShow={posts}
              hasMore={postsHasMore}
              isLoadingMore={isLoadingMorePosts}
              loadMoreRef={postsLoadMoreRef}
            />
          </TabsContent>

          {isOwnProfile && (
            <>
              <TabsContent value="boosts" className="mt-4">
                <PostList 
                  postsToShow={boostedPosts}
                  hasMore={boostedPostsHasMore}
                  isLoadingMore={isLoadingMoreBoosted}
                  loadMoreRef={boostedLoadMoreRef}
                />
              </TabsContent>

              <TabsContent value="saved" className="mt-4">
                <PostList 
                  postsToShow={savedPosts}
                  hasMore={savedPostsHasMore}
                  isLoadingMore={isLoadingMoreSaved}
                  loadMoreRef={savedLoadMoreRef}
                />
              </TabsContent>
            </>
          )}

          <TabsContent value="got-boosted" className="mt-4">
            <PostList 
              postsToShow={gotBoostedPosts}
              hasMore={gotBoostedPostsHasMore}
              isLoadingMore={isLoadingMoreGotBoosted}
              loadMoreRef={gotBoostedLoadMoreRef}
            />
          </TabsContent>

          <TabsContent value="communities" className="mt-4">
            {communities.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-white/60">No communities yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {communities.map((community) => (
                  <Link
                    key={community.id}
                    href={`/${community.slug}`}
                    className="block touch-feedback"
                    prefetch={true}
                  >
                    <Card className="group bg-white/10 backdrop-blur-md border-0 hover:bg-white/15 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <CommunityLogo
                            name={community.name}
                            logoUrl={community.logo_url}
                            size="lg"
                            className="border border-white/20 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white/90 font-semibold text-base mb-1">
                              {community.name}
                            </h3>
                            {community.description && (
                              <p className="text-white/60 text-sm line-clamp-2">
                                {community.description}
                              </p>
                            )}
              </div>
            </div>
          </CardContent>
        </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
