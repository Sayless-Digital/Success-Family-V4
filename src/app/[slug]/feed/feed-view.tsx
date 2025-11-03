"use client"

import React, { useMemo, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { FileText, Pin, Crown, Bookmark, Home, Users, MessageSquare, Shield, MoreVertical, Edit, Trash2 } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import confetti from "canvas-confetti"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { InlinePostComposer } from "@/components/inline-post-composer"
import { PostMediaSlider } from "@/components/post-media-slider"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import type { Post, User as UserType, MediaType } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ImageIcon, Mic, Play, Pause, X, Save } from "lucide-react"
import { VoiceNoteRecorder } from "@/components/voice-note-recorder"

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
  isMember: initialIsMember,
  currentUserId
}: FeedViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, userProfile, walletBalance, refreshWalletBalance } = useAuth()
  
  // Optimistically determine membership immediately (before async check)
  const isMemberOptimistic = React.useMemo(() => {
    if (!user || !community?.id) return initialIsMember
    // If user is owner, they're always a member
    if (community.owner_id === user.id) return true
    // Use initial value as fallback until we check
    return initialIsMember
  }, [user, community?.id, community?.owner_id, initialIsMember])
  
  const [isMember, setIsMember] = React.useState(isMemberOptimistic)

  // Update immediately when optimistic value changes
  React.useEffect(() => {
    setIsMember(isMemberOptimistic)
  }, [isMemberOptimistic])

  // Initial membership check + Realtime subscription for instant updates
  React.useEffect(() => {
    if (!user || !community?.id) {
      setIsMember(false)
      return
    }

    // If user is owner, they're always a member
    if (community.owner_id === user.id) {
      setIsMember(true)
      return
    }

    // Initial check
    const checkMembership = async () => {
      const { data: membership } = await supabase
        .from('community_members')
        .select('id')
        .eq('community_id', community.id)
        .eq('user_id', user.id)
        .single()
      
      setIsMember(!!membership)
    }

    checkMembership()

    // Subscribe to realtime changes for instant updates when user joins/leaves
    const channel = supabase
      .channel(`community-membership-${community.id}-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'community_members',
          filter: `community_id=eq.${community.id} AND user_id=eq.${user.id}`
        },
        (payload) => {
          // Immediately update membership based on realtime event
          if (payload.eventType === 'INSERT') {
            setIsMember(true)
          } else if (payload.eventType === 'DELETE') {
            setIsMember(false)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, community?.id, community?.owner_id])

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

      interface PostCandidate {
        element: Element
        distance: number
      }
      let closestPost: PostCandidate | null = null

      Array.from(postElements).forEach((el) => {
        const element = el as Element
        const rect = element.getBoundingClientRect()
        // Calculate distance from top of viewport (negative means it's above)
        const distanceFromTop = rect.top < 0 ? -rect.top : rect.top
        
        // Find the post that's closest to the top but still visible
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          const candidate: PostCandidate = { element, distance: distanceFromTop }
          if (!closestPost || distanceFromTop < closestPost.distance) {
            closestPost = candidate
          }
        }
      })

      if (closestPost) {
        const postId = (closestPost as PostCandidate).element.getAttribute('data-post-id')
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
    try {
      // Get the most recent post timestamp from current posts
      const mostRecentPost = posts.length > 0 
        ? posts.reduce((latest, post) => {
            const postDate = new Date(post.published_at || post.created_at)
            const latestDate = new Date(latest.published_at || latest.created_at)
            return postDate > latestDate ? post : latest
          })
        : null

      // Fetch new posts that were created after the most recent one
      const { data: newPostsData, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:users!posts_author_id_fkey(
            id,
            username,
            first_name,
            last_name,
            profile_picture
          ),
          media:post_media(
            id,
            media_type,
            storage_path,
            file_name,
            display_order
          )
        `)
        .eq('community_id', community.id)
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Error fetching new posts:', error)
        toast.error('Failed to load new posts')
        return
      }

      if (!newPostsData || newPostsData.length === 0) {
        setNewPostsCount(0)
        toast.info('No new posts to load')
        return
      }

      // Filter out posts that already exist in the current list
      const existingPostIds = new Set(posts.map(p => p.id))
      const trulyNewPosts = newPostsData.filter(p => !existingPostIds.has(p.id))

      if (trulyNewPosts.length === 0) {
        setNewPostsCount(0)
        toast.info('No new posts to load')
        return
      }

      // Enrich new posts with boost counts and user's boost status
      const enrichedNewPosts = await Promise.all(
        trulyNewPosts.map(async (post) => {
          // Get boost count
          const { data: boostCountData } = await supabase
            .rpc('get_post_boost_count', { p_post_id: post.id })

          // Get user's boost status if authenticated
          let userHasBoosted = false
          let canUnboost = false
          if (user) {
            const { data: userBoostedData } = await supabase
              .rpc('user_boosted_post', {
                p_post_id: post.id,
                p_user_id: user.id
              })
            userHasBoosted = userBoostedData || false

            // Check if user can unboost (within 1 minute)
            if (userHasBoosted) {
              const { data: canUnboostData } = await supabase
                .rpc('can_unboost_post', {
                  p_post_id: post.id,
                  p_user_id: user.id
                })
              canUnboost = canUnboostData || false
            }
          }

          return {
            ...post,
            boost_count: boostCountData || 0,
            user_has_boosted: userHasBoosted,
            can_unboost: canUnboost
          }
        })
      )

      // Prepend new posts to the existing list
      setPosts(prevPosts => [...enrichedNewPosts, ...prevPosts])
      setNewPostsCount(0)
      
      toast.success(`Loaded ${enrichedNewPosts.length} new ${enrichedNewPosts.length === 1 ? 'post' : 'posts'}`)
    } catch (error: any) {
      console.error('Error loading new posts:', error)
      toast.error('Failed to load new posts')
    }
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

  const [editingPostId, setEditingPostId] = React.useState<string | null>(null)
  const [editingContent, setEditingContent] = React.useState<Record<string, string>>({})
  const [editingExistingMedia, setEditingExistingMedia] = React.useState<Record<string, Array<{ id: string; preview: string; type: MediaType; storagePath: string }>>>({})
  const [editingNewMedia, setEditingNewMedia] = React.useState<Record<string, Array<{ file: File; preview: string; type: MediaType }>>>({})
  const [editingSubmitting, setEditingSubmitting] = React.useState<Record<string, boolean>>({})
  const [editingShowVoiceRecorder, setEditingShowVoiceRecorder] = React.useState<string | null>(null)
  const [editingPlayingAudio, setEditingPlayingAudio] = React.useState<Record<string, string | null>>({})
  const [editingAudioProgress, setEditingAudioProgress] = React.useState<Record<string, Record<string, { current: number; duration: number }>>>({})
  const editingAudioRefs = React.useRef<Record<string, Record<string, HTMLAudioElement>>>({})
  const editingFileInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({})
  const [deletingPostId, setDeletingPostId] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  interface EditingMediaFile {
    file: File
    preview: string
    type: MediaType
  }

  interface EditingExistingMediaItem {
    id: string
    preview: string
    type: MediaType
    storagePath: string
  }

  const handleEditPost = (post: PostWithAuthor) => {
    setEditingPostId(post.id)
    setEditingContent(prev => ({ ...prev, [post.id]: post.content }))
    
    // Load existing media
    if (post.media) {
      const existing: EditingExistingMediaItem[] = post.media.map(m => ({
        id: m.id!,
        preview: supabase.storage.from('post-media').getPublicUrl(m.storage_path).data.publicUrl,
        type: m.media_type,
        storagePath: m.storage_path
      }))
      setEditingExistingMedia(prev => ({ ...prev, [post.id]: existing }))
      
      // Preload audio metadata for existing voice notes
      const existingAudio = existing.find(m => m.type === 'audio')
      if (existingAudio) {
        const audio = new Audio(existingAudio.preview)
        audio.addEventListener('loadedmetadata', () => {
          setEditingAudioProgress(prev => ({
            ...prev,
            [post.id]: {
              ...(prev[post.id] || {}),
              [existingAudio.preview]: {
                current: 0,
                duration: audio.duration || 0
              }
            }
          }))
        })
        audio.addEventListener('timeupdate', () => {
          setEditingAudioProgress(prev => ({
            ...prev,
            [post.id]: {
              ...(prev[post.id] || {}),
              [existingAudio.preview]: {
                current: audio.currentTime,
                duration: audio.duration || 0
              }
            }
          }))
        })
        audio.addEventListener('ended', () => {
          setEditingPlayingAudio(prev => ({
            ...prev,
            [post.id]: null
          }))
        })
        audio.addEventListener('pause', () => {
          if (audio.ended) {
            setEditingPlayingAudio(prev => ({
              ...prev,
              [post.id]: null
            }))
          }
        })
        if (!editingAudioRefs.current[post.id]) {
          editingAudioRefs.current[post.id] = {}
        }
        editingAudioRefs.current[post.id][existingAudio.preview] = audio
        audio.load()
      }
    }
    
    setEditingNewMedia(prev => ({ ...prev, [post.id]: [] }))
  }

  const handleCancelEdit = (postId: string) => {
    setEditingPostId(null)
    setEditingContent(prev => {
      const updated = { ...prev }
      delete updated[postId]
      return updated
    })
    setEditingExistingMedia(prev => {
      const updated = { ...prev }
      delete updated[postId]
      return updated
    })
    setEditingNewMedia(prev => {
      const newMedia = prev[postId] || []
      newMedia.forEach(m => URL.revokeObjectURL(m.preview))
      const updated = { ...prev }
      delete updated[postId]
      return updated
    })
    setEditingShowVoiceRecorder(null)
    setEditingPlayingAudio(prev => {
      const updated = { ...prev }
      delete updated[postId]
      return updated
    })
    setEditingAudioProgress(prev => {
      const updated = { ...prev }
      delete updated[postId]
      return updated
    })
    // Cleanup audio refs
    if (editingAudioRefs.current[postId]) {
      Object.values(editingAudioRefs.current[postId]).forEach(audio => {
        audio.pause()
        audio.src = ''
      })
      delete editingAudioRefs.current[postId]
    }
  }

  const formatAudioTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleEditingVoiceNoteComplete = async (postId: string, audioBlob: Blob) => {
    if (!user) return

    if (walletBalance === null || walletBalance < 1) {
      toast.error("You need at least 1 point to add a voice note")
      setEditingShowVoiceRecorder(null)
      return
    }

    const preview = URL.createObjectURL(audioBlob)
    const fileName = `voice-note-${Date.now()}.webm`
    const file = new File([audioBlob], fileName, { type: 'audio/webm' })

    const audio = new Audio(preview)
    audio.addEventListener('loadedmetadata', () => {
      setEditingAudioProgress(prev => ({
        ...prev,
        [postId]: {
          ...(prev[postId] || {}),
          [preview]: {
            current: 0,
            duration: audio.duration || 0
          }
        }
      }))
    })
    audio.addEventListener('timeupdate', () => {
      setEditingAudioProgress(prev => ({
        ...prev,
        [postId]: {
          ...(prev[postId] || {}),
          [preview]: {
            current: audio.currentTime,
            duration: audio.duration || 0
          }
        }
      }))
    })
    audio.addEventListener('ended', () => {
      setEditingPlayingAudio(prev => ({
        ...prev,
        [postId]: null
      }))
    })
    audio.addEventListener('pause', () => {
      if (audio.ended) {
        setEditingPlayingAudio(prev => ({
          ...prev,
          [postId]: null
        }))
      }
    })
    if (!editingAudioRefs.current[postId]) {
      editingAudioRefs.current[postId] = {}
    }
    editingAudioRefs.current[postId][preview] = audio
    audio.load()

    setEditingNewMedia(prev => ({
      ...prev,
      [postId]: [...(prev[postId] || []), { file, preview, type: 'audio' }]
    }))
    setEditingShowVoiceRecorder(null)
  }

  const handleEditingFileSelect = (postId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newFiles: EditingMediaFile[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document'
    }))
    setEditingNewMedia(prev => ({
      ...prev,
      [postId]: [...(prev[postId] || []), ...newFiles]
    }))
    if (editingFileInputRefs.current[postId]) {
      editingFileInputRefs.current[postId]!.value = ''
    }
  }

  const handleEditingRemoveNewMedia = (postId: string, index: number) => {
    setEditingNewMedia(prev => {
      const newFiles = [...(prev[postId] || [])]
      const removedMedia = newFiles[index]

      if (removedMedia.type === 'audio' && editingAudioRefs.current[postId]?.[removedMedia.preview]) {
        const audio = editingAudioRefs.current[postId][removedMedia.preview]
        audio.pause()
        audio.src = ''
        delete editingAudioRefs.current[postId][removedMedia.preview]
      }
      if (removedMedia.type === 'audio') {
        setEditingAudioProgress(prev => {
          const updated = { ...prev }
          if (updated[postId]) {
            const postProgress = { ...updated[postId] }
            delete postProgress[removedMedia.preview]
            updated[postId] = postProgress
          }
          return updated
        })
      }
      URL.revokeObjectURL(removedMedia.preview)
      newFiles.splice(index, 1)
      return { ...prev, [postId]: newFiles }
    })
  }

  const handleEditingRemoveExistingMedia = async (postId: string, mediaId: string, storagePath: string) => {
    try {
      await supabase.storage.from('post-media').remove([storagePath])
      await supabase.from('post_media').delete().eq('id', mediaId)
      
      setEditingExistingMedia(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(m => m.id !== mediaId)
      }))
      toast.success("Media removed")
    } catch (error: any) {
      console.error('Error removing media:', error)
      toast.error('Failed to remove media')
    }
  }

  const handleEditingAudioPlay = (postId: string, previewUrl: string) => {
    Object.keys(editingAudioRefs.current[postId] || {}).forEach(key => {
      if (key !== previewUrl) {
        const audio = editingAudioRefs.current[postId][key]
        if (audio && !audio.paused) {
          audio.pause()
          audio.currentTime = 0
        }
      }
    })

    if (!editingAudioRefs.current[postId]?.[previewUrl]) {
      const audio = new Audio(previewUrl)
      
      audio.addEventListener('loadedmetadata', () => {
        setEditingAudioProgress(prev => ({
          ...prev,
          [postId]: {
            ...(prev[postId] || {}),
            [previewUrl]: {
              current: 0,
              duration: audio.duration || 0
            }
          }
        }))
      })
      
      audio.addEventListener('timeupdate', () => {
        setEditingAudioProgress(prev => ({
          ...prev,
          [postId]: {
            ...(prev[postId] || {}),
            [previewUrl]: {
              current: audio.currentTime,
              duration: audio.duration || 0
            }
          }
        }))
      })
      
      audio.addEventListener('ended', () => {
        setEditingPlayingAudio(prev => ({
          ...prev,
          [postId]: null
        }))
      })
      
      audio.addEventListener('pause', () => {
        if (audio.ended) {
          setEditingPlayingAudio(prev => ({
            ...prev,
            [postId]: null
          }))
        }
      })
      
      if (!editingAudioRefs.current[postId]) {
        editingAudioRefs.current[postId] = {}
      }
      editingAudioRefs.current[postId][previewUrl] = audio
      audio.load()
    }

    const audio = editingAudioRefs.current[postId][previewUrl]
    
    if (editingPlayingAudio[postId] === previewUrl) {
      audio.pause()
      setEditingPlayingAudio(prev => ({ ...prev, [postId]: null }))
    } else {
      audio.play()
      setEditingPlayingAudio(prev => ({ ...prev, [postId]: previewUrl }))
    }
  }

  const handleSaveEdit = async (post: PostWithAuthor) => {
    if (!user) return
    const postId = post.id

    const content = editingContent[postId]?.trim() || ''
    const existingMedia = editingExistingMedia[postId] || []
    const newMedia = editingNewMedia[postId] || []

    if (!content && existingMedia.length === 0 && newMedia.length === 0) {
      toast.error("Post cannot be empty")
      return
    }

    setEditingSubmitting(prev => ({ ...prev, [postId]: true }))

    try {
      // Update post content
      const { error: updateError } = await supabase
        .from('posts')
        .update({
          content: content,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId)

      if (updateError) throw updateError

      // Upload new media files
      for (let i = 0; i < newMedia.length; i++) {
        const media = newMedia[i]
        const fileName = `${postId}-${Date.now()}-${i}.${media.file.name.split('.').pop()}`
        const filePath = `${post.community_id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(filePath, media.file, { upsert: false })

        if (uploadError) throw uploadError

        if (media.type === 'audio') {
          const { error: deductError } = await supabase.rpc('deduct_points_for_voice_notes', {
            p_user_id: user.id,
            p_point_cost: 1
          })
          if (deductError) throw deductError
        }

        const { error: mediaError } = await supabase.from('post_media').insert({
          post_id: postId,
          media_type: media.type,
          storage_path: filePath,
          file_name: media.file.name,
          file_size: media.file.size,
          mime_type: media.file.type,
          display_order: existingMedia.length + i
        })

        if (mediaError) throw mediaError
      }

      await refreshWalletBalance?.()

      // Fetch updated post
      const { data: updatedPostData, error: fetchError } = await supabase
        .from('posts')
        .select(`
          *,
          author:users!posts_author_id_fkey(
            id,
            username,
            first_name,
            last_name,
            profile_picture
          ),
          media:post_media(
            id,
            media_type,
            storage_path,
            file_name,
            display_order
          )
        `)
        .eq('id', postId)
        .single()

      if (fetchError) throw fetchError

      toast.success("Post updated successfully")
      handlePostUpdate(updatedPostData as PostWithAuthor)
      handleCancelEdit(postId)
    } catch (error: any) {
      console.error('Error updating post:', error)
      toast.error(error.message || 'Failed to update post')
    } finally {
      setEditingSubmitting(prev => {
        const updated = { ...prev }
        delete updated[postId]
        return updated
      })
    }
  }

  const handleDeletePost = (postId: string) => {
    setDeletingPostId(postId)
  }

  const confirmDeletePost = async () => {
    if (!deletingPostId) return

    setIsDeleting(true)

    try {
      // Delete post media from storage first
      const { data: mediaData } = await supabase
        .from('post_media')
        .select('storage_path')
        .eq('post_id', deletingPostId)

      if (mediaData) {
        const paths = mediaData.map(m => m.storage_path).filter(Boolean)
        if (paths.length > 0) {
          await supabase.storage.from('post-media').remove(paths)
        }
      }

      // Delete the post (this will cascade delete media records)
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', deletingPostId)

      if (error) throw error

      // Remove from local state
      setPosts(prevPosts => prevPosts.filter(p => p.id !== deletingPostId))
      toast.success("Post deleted successfully")
      setDeletingPostId(null)
    } catch (error: any) {
      console.error('Error deleting post:', error)
      toast.error('Failed to delete post. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handlePostUpdate = (updatedPost: PostWithAuthor) => {
    setPosts(prevPosts =>
      prevPosts.map(p => p.id === updatedPost.id ? updatedPost : p)
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "just now"
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
              className="bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg hover:bg-primary/90 transition-all animate-bounce text-sm font-medium backdrop-blur-sm border border-white/20 cursor-pointer"
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
                  <div className="flex items-center gap-2 flex-1">
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

                  {/* Context Menu - Only show for post owner */}
                  {user && post.author_id === user.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-center w-8 h-8 p-0 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30 flex-shrink-0"
                        >
                          <MoreVertical className="h-4 w-4 text-white/70" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {(() => {
                          const postDate = new Date(post.created_at)
                          const now = new Date()
                          const diffMs = now.getTime() - postDate.getTime()
                          const diffMins = diffMs / 60000
                          const canEdit = diffMins < 5
                          
                          return (
                            <>
                              {/* Edit option - only if within 5 minutes */}
                              {canEdit && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditPost(post)
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Edit className="h-4 w-4 mr-2 text-white/70" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {/* Separator only if Edit option exists */}
                              {canEdit && <DropdownMenuSeparator />}
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeletePost(post.id)
                                }}
                                className="cursor-pointer text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )
                        })()}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                
                {/* Content - Edit Mode or View Mode */}
                {editingPostId === post.id ? (
                  <div className="space-y-4">
                    {/* Editable Content */}
                    <div className="bg-white/10 border border-white/20 rounded-lg p-4">
                      <textarea
                        value={editingContent[post.id] || ''}
                        onChange={(e) => setEditingContent(prev => ({ ...prev, [post.id]: e.target.value }))}
                        placeholder="What's on your mind?"
                        className="w-full bg-transparent border-0 text-white placeholder:text-white/40 text-base resize-none focus:outline-none focus:ring-0 min-h-[100px]"
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement
                          target.style.height = 'auto'
                          target.style.height = Math.max(100, target.scrollHeight) + 'px'
                        }}
                      />
                    </div>

                    {/* Voice Note Recorder */}
                    {editingShowVoiceRecorder === post.id && (
                      <VoiceNoteRecorder
                        onRecordingComplete={(audioBlob) => handleEditingVoiceNoteComplete(post.id, audioBlob)}
                        onCancel={() => setEditingShowVoiceRecorder(null)}
                        maxDurationMinutes={5}
                        autoStart={true}
                      />
                    )}

                    {/* Voice Note Preview - Separate Container */}
                    {(() => {
                      const existingVoiceNote = editingExistingMedia[post.id]?.find(m => m.type === 'audio')
                      const newVoiceNote = editingNewMedia[post.id]?.find(m => m.type === 'audio')
                      const currentVoiceNote = newVoiceNote || existingVoiceNote
                      
                      return currentVoiceNote && (
                        <div className="rounded-lg overflow-hidden bg-white/10 border border-white/20">
                          <div className="p-3 relative overflow-hidden">
                            <div className="flex items-center gap-2">
                              <div className="font-mono text-sm text-white/80">
                                {editingAudioProgress[post.id]?.[currentVoiceNote.preview]?.duration
                                  ? `${formatAudioTime(editingAudioProgress[post.id][currentVoiceNote.preview].current || 0)} / ${formatAudioTime(editingAudioProgress[post.id][currentVoiceNote.preview].duration)}`
                                  : `0:00 / —`
                                }
                              </div>
                              <div className="flex-1" />
                              <button
                                type="button"
                                onClick={() => handleEditingAudioPlay(post.id, currentVoiceNote.preview)}
                                className="flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
                              >
                                {editingPlayingAudio[post.id] === currentVoiceNote.preview ? (
                                  <Pause className="h-4 w-4 text-white/70" />
                                ) : (
                                  <Play className="h-4 w-4 text-white/70" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (currentVoiceNote === newVoiceNote) {
                                    const index = editingNewMedia[post.id]?.findIndex(m => m.preview === currentVoiceNote.preview) ?? -1
                                    if (index >= 0) handleEditingRemoveNewMedia(post.id, index)
                                  } else {
                                    handleEditingRemoveExistingMedia(post.id, currentVoiceNote.id, currentVoiceNote.storagePath)
                                  }
                                }}
                                className="flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30 flex-shrink-0"
                              >
                                <Trash2 className="h-4 w-4 text-white/70" />
                              </button>
                            </div>
                            <div
                              className="w-full h-2 bg-white/10 rounded-full mt-2 cursor-pointer relative group backdrop-blur-sm overflow-visible"
                              onClick={(e) => {
                                const audio = editingAudioRefs.current[post.id]?.[currentVoiceNote.preview]
                                if (!audio || !editingAudioProgress[post.id]?.[currentVoiceNote.preview]?.duration) return
                                
                                const rect = e.currentTarget.getBoundingClientRect()
                                const clickX = e.clientX - rect.left
                                const percentage = clickX / rect.width
                                const newTime = percentage * editingAudioProgress[post.id][currentVoiceNote.preview].duration
                                
                                audio.currentTime = Math.max(0, Math.min(newTime, audio.duration))
                              }}
                            >
                              <div
                                className="h-full bg-gradient-to-r from-white via-white to-white transition-all duration-100 rounded-full shadow-[0_0_4px_rgba(255,255,255,0.5),0_0_8px_rgba(255,255,255,0.3)] relative"
                                style={{
                                  width: editingAudioProgress[post.id]?.[currentVoiceNote.preview]?.duration
                                    ? `${(editingAudioProgress[post.id][currentVoiceNote.preview].current || 0) / editingAudioProgress[post.id][currentVoiceNote.preview].duration * 100}%`
                                    : '0%'
                                }}
                              >
                                <div
                                  className={cn(
                                    "absolute right-0 top-1/2 w-8 h-8 bg-white/90 blur-lg rounded-full pointer-events-none",
                                    editingPlayingAudio[post.id] === currentVoiceNote.preview && "animate-edge-glow"
                                  )}
                                  style={{ transform: 'translate(50%, -50%)' }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Images Preview Slider */}
                    {(() => {
                      const existingImages = editingExistingMedia[post.id]?.filter(m => m.type !== 'audio') || []
                      const newImages = editingNewMedia[post.id]?.filter(m => m.type !== 'audio') || []
                      const allImages = [...existingImages, ...newImages]
                      
                      return allImages.length > 0 && (
                        <div className="relative">
                          <div className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth">
                            {existingImages.map((media) => (
                              <div
                                key={`existing-${media.id}`}
                                className="relative flex-shrink-0 rounded-lg bg-white/10 border border-white/20 group overflow-hidden"
                                style={{
                                  width: 'calc((100% - 3 * 0.5rem) / 4)',
                                  aspectRatio: '1 / 1',
                                }}
                              >
                                <img
                                  src={media.preview}
                                  alt="Existing media"
                                  className="w-full h-full object-cover rounded-lg"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleEditingRemoveExistingMedia(post.id, media.id, media.storagePath)}
                                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="h-4 w-4 text-white" />
                                </button>
                              </div>
                            ))}
                            {newImages.map((media, index) => (
                              <div
                                key={`new-${index}`}
                                className="relative flex-shrink-0 rounded-lg bg-white/10 border border-white/20 group overflow-hidden"
                                style={{
                                  width: 'calc((100% - 3 * 0.5rem) / 4)',
                                  aspectRatio: '1 / 1',
                                }}
                              >
                                <img
                                  src={media.preview}
                                  alt="New media"
                                  className="w-full h-full object-cover rounded-lg"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const actualIndex = editingNewMedia[post.id]?.findIndex(m => m.preview === media.preview) ?? index
                                    handleEditingRemoveNewMedia(post.id, actualIndex)
                                  }}
                                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="h-4 w-4 text-white" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {/* Add Image Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (!editingFileInputRefs.current[post.id]) {
                            const input = document.createElement('input')
                            input.type = 'file'
                            input.multiple = true
                            input.accept = 'image/*'
                            input.onchange = (e) => handleEditingFileSelect(post.id, e as any)
                            editingFileInputRefs.current[post.id] = input
                          }
                          editingFileInputRefs.current[post.id]?.click()
                        }}
                        className="flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
                      >
                        <ImageIcon className="h-4 w-4 text-white/70" />
                        <span className="sr-only">Add Image</span>
                      </button>

                      {/* Add Voice Note Button */}
                      <button
                        type="button"
                        onClick={() => setEditingShowVoiceRecorder(editingShowVoiceRecorder === post.id ? null : post.id)}
                        disabled={!!editingExistingMedia[post.id]?.find(m => m.type === 'audio') || !!editingNewMedia[post.id]?.find(m => m.type === 'audio')}
                        className="flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Mic className="h-4 w-4 text-white/70" />
                        <span className="sr-only">Add Voice Note</span>
                      </button>

                      <div className="flex-1" />

                      {/* Cancel Button */}
                      <button
                        type="button"
                        onClick={() => handleCancelEdit(post.id)}
                        disabled={editingSubmitting[post.id]}
                        className="px-4 py-2 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed text-white/70 text-sm"
                      >
                        Cancel
                      </button>

                      {/* Save Button */}
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(post)}
                        disabled={editingSubmitting[post.id]}
                        className="flex items-center gap-2 px-4 py-2 rounded-full border transition-all cursor-pointer bg-white/10 border-white/30 hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed text-white/80 text-sm font-medium"
                      >
                        {editingSubmitting[post.id] ? (
                          <>Saving...</>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            Save
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Content Preview */}
                    <p className="text-white/80 text-base line-clamp-3">
                      {post.content}
                    </p>

                    {/* Post Media Slider */}
                    {post.media && post.media.length > 0 && (
                      <PostMediaSlider media={post.media} author={post.author} />
                    )}
                  </>
                )}

                {/* Boost and Save Buttons - Hide when editing */}
                {editingPostId !== post.id && (
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
                )}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingPostId} onOpenChange={(open) => !open && !isDeleting && setDeletingPostId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader className="space-y-2">
            <DialogTitle>Delete Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="destructive"
              onClick={confirmDeletePost}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}