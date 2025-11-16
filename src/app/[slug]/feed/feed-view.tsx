"use client"

import React, { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { FileText, Pin, Crown, Bookmark, MoreVertical, Edit, Trash2, TrendingUp } from "lucide-react"
import { CommunityNavigation } from "@/components/community-navigation"
import { TopUpGuard } from "@/components/topup-guard"
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
import { fetchCommentsForPosts } from "@/lib/api/posts"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { PostWithAuthor, MediaType, HierarchicalPost } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ImageIcon, Mic, Play, Pause, X, Save, Feather, ArrowLeft, ArrowRight, ChevronDown, ChevronRight } from "lucide-react"
import { ScrollToTop } from "@/components/scroll-to-top"
import { VoiceNoteRecorder } from "@/components/voice-note-recorder"
import { LoadingSpinner } from "@/components/loading-spinner"

const RELATIVE_TIME_REFRESH_INTERVAL = 60_000

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
  hasMore: boolean
  initialRelativeTimes?: Record<string, string>
}

export default function FeedView({
  community,
  posts: initialPosts,
  isMember: initialIsMember,
  currentUserId,
  hasMore: initialHasMore,
  initialRelativeTimes = {}
}: FeedViewProps) {
  const router = useRouter()
  const { user, userProfile, walletBalance, walletEarningsBalance, refreshWalletBalance } = useAuth()
  
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

  const [posts, setPosts] = useState(initialPosts)
  const [boostingPosts, setBoostingPosts] = useState<Set<string>>(new Set())
  const [boostedPostIds, setBoostedPostIds] = useState<Set<string>>(
    () => new Set(initialPosts.filter((post) => post.user_has_boosted).map((post) => post.id))
  )
  const [savingPosts, setSavingPosts] = useState<Set<string>>(new Set())
  React.useEffect(() => {
    setBoostedPostIds(new Set(posts.filter((post) => post.user_has_boosted).map((post) => post.id)))
  }, [posts])
  const [topVisiblePostId, setTopVisiblePostId] = useState<string | null>(null)
  const [animatingBoosts, setAnimatingBoosts] = useState<Set<string>>(new Set())
  const [newPostsCount, setNewPostsCount] = useState(0)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const loadMoreRef = React.useRef<HTMLDivElement>(null)
  const [commentComposerOpen, setCommentComposerOpen] = useState<string | null>(null)
  const [commentComposerIndex, setCommentComposerIndex] = useState<number | null>(null)
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, HierarchicalPost[]>>({})
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({})
  const fetchedCommentsRef = React.useRef<Set<string>>(new Set())
  const [activeReplyTarget, setActiveReplyTarget] = useState<{ postId: string; commentId: string } | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
const [expandedReplies, setExpandedReplies] = React.useState<Record<string, boolean>>({})

  // Use server-provided times initially, then update client-side only
  const [relativeTimes, setRelativeTimes] = React.useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    initialPosts.forEach((post) => {
      // Always prefer server-provided times for SSR consistency
      map[post.id] = initialRelativeTimes?.[post.id] ?? formatRelativeTime(post.published_at || post.created_at)
    })
    return map
  })

  // Update relative times only for new posts (not in initialRelativeTimes)
  React.useEffect(() => {
    setRelativeTimes((prev) => {
      const next = { ...prev }
      let changed = false

      posts.forEach((post) => {
        // Only update if not already set from server
        if (!initialRelativeTimes?.[post.id] && !prev[post.id]) {
          next[post.id] = formatRelativeTime(post.published_at || post.created_at)
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [posts, initialRelativeTimes])

  // Update all relative times periodically after initial hydration
  React.useEffect(() => {
    const updateRelativeTimes = () => {
      setRelativeTimes((prev) => {
        let changed = false
        const next: Record<string, string> = { ...prev }

        for (const post of posts) {
          const value = formatRelativeTime(post.published_at || post.created_at)
          
          // Only update if value actually changed
          if (prev[post.id] !== value) {
            next[post.id] = value
            changed = true
          }
        }

        return changed ? next : prev
      })
    }

    // Start periodic updates after a short delay to allow hydration to complete
    const timeoutId = setTimeout(() => {
      updateRelativeTimes()
    }, 1000)

    const intervalId = window.setInterval(updateRelativeTimes, RELATIVE_TIME_REFRESH_INTERVAL)

    return () => {
      clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [posts])

  React.useEffect(() => {
    if (!activeReplyTarget) {
      setReplyContent("")
      setReplyError(null)
    }
  }, [activeReplyTarget])

  React.useEffect(() => {
    if (!commentComposerOpen) {
      setActiveReplyTarget(null)
      setReplyContent("")
      setReplyError(null)
      setCommentComposerIndex(null)
    }
  }, [commentComposerOpen])

  const loadCommentsForPostIds = React.useCallback(
    async (postIds: string[]) => {
      const ids = postIds.filter(Boolean)
      if (ids.length === 0) return

      setCommentsLoading((prev) => {
        const next = { ...prev }
        ids.forEach((id) => {
          next[id] = true
        })
        return next
      })

      try {
        const commentMap = await fetchCommentsForPosts(ids, user?.id || undefined)

        setCommentsByPostId((prev) => {
          const next = { ...prev }
          ids.forEach((id) => {
            next[id] = commentMap[id] ?? []
            fetchedCommentsRef.current.add(id)
          })
          return next
        })

        if (user) {
          setBoostedPostIds((prev) => {
            const next = new Set(prev)
            Object.values(commentMap).forEach((list) => {
              list.forEach((comment) => {
                if (comment.user_has_boosted) {
                  next.add(comment.id)
                }
                comment.replies?.forEach((reply) => {
                  if (reply.user_has_boosted) {
                    next.add(reply.id)
                  }
                })
              })
            })
            return next
          })
        }
      } catch (error) {
        console.error("Error loading comments:", error)
        toast.error("Failed to load comments")
      } finally {
        setCommentsLoading((prev) => {
          const next = { ...prev }
          ids.forEach((id) => {
            next[id] = false
          })
          return next
        })
      }
    },
    [user],
  )

  React.useEffect(() => {
    const newIds = posts
      .map((post) => post.id)
      .filter((id) => !fetchedCommentsRef.current.has(id))

    if (newIds.length === 0) return

    newIds.forEach((id) => fetchedCommentsRef.current.add(id))
    loadCommentsForPostIds(newIds)
  }, [posts, loadCommentsForPostIds])

  const handleCommentCreated = React.useCallback((postId: string, comment: PostWithAuthor) => {
    setCommentsByPostId((prev) => {
      const existing = prev[postId] ?? []
      const hydrated: HierarchicalPost = {
        ...comment,
        boost_count: comment.boost_count ?? 0,
        user_has_boosted: comment.user_has_boosted ?? false,
        can_unboost: comment.can_unboost ?? false,
        replies: [],
      }
      const next = [...existing, hydrated].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      return {
        ...prev,
        [postId]: next,
      }
    })
  }, [])

  const toggleRepliesVisibility = React.useCallback((commentId: string) => {
    setExpandedReplies((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }))
  }, [])

  const submitReply = async (postId: string, commentId: string) => {
    if (!user) {
      toast.error("Please sign in to reply.")
      return
    }

    const trimmed = replyContent.trim()
    if (!trimmed) {
      setReplyError("Reply cannot be empty.")
      return
    }

    setReplySubmitting(true)
    setReplyError(null)

    try {
      const { data: insertedReply, error } = await supabase
        .from("posts")
        .insert({
          community_id: community.id,
          author_id: user.id,
          content: trimmed,
          parent_post_id: commentId,
          published_at: new Date().toISOString(),
        })
        .select(
          `
            *,
            author:users!posts_author_id_fkey(
              id,
              username,
              first_name,
              last_name,
              profile_picture,
              bio
            ),
            media:post_media(
              id,
              media_type,
              storage_path,
              file_name,
              display_order
            )
          `,
        )
        .single()

      if (error) {
        throw new Error(error.message)
      }

      const replyWithMeta = {
        ...insertedReply,
        boost_count: insertedReply?.boost_count ?? 0,
        user_has_boosted: insertedReply?.user_has_boosted ?? false,
        can_unboost: insertedReply?.can_unboost ?? false,
      } as PostWithAuthor

      setCommentsByPostId((prev) => {
        const existing = prev[postId] ?? []
        return {
          ...prev,
          [postId]: existing.map((comment) => {
            if (comment.id !== commentId) return comment
            const replies = [...(comment.replies ?? []), replyWithMeta].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            )
            return {
              ...comment,
              replies,
            }
          }),
        }
      })

      setActiveReplyTarget(null)
      setReplyContent("")
      toast.success("Reply posted!")
    } catch (error: any) {
      console.error("Error posting reply:", error)
      setReplyError(error?.message || "Failed to post reply.")
      toast.error(error?.message || "Failed to post reply.")
    } finally {
      setReplySubmitting(false)
    }
  }

  const previousUserIdRef = React.useRef<string | undefined>(user?.id)

  React.useEffect(() => {
    if (previousUserIdRef.current === user?.id) {
      return
    }

    previousUserIdRef.current = user?.id
    fetchedCommentsRef.current.clear()
    setCommentsByPostId({})
    setCommentsLoading({})

    const ids = posts.map((post) => post.id)
    if (ids.length === 0) return

    loadCommentsForPostIds(ids)
    ids.forEach((id) => fetchedCommentsRef.current.add(id))
  }, [user?.id, posts, loadCommentsForPostIds])

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

  // Real-time subscription for boost counts - OPTIMIZED with batching and debouncing
  React.useEffect(() => {
    if (!community?.id || posts.length === 0) return

    const currentUserId = user?.id
    const updateQueue = new Map<string, { count: number; isCurrentUser: boolean; eventType: string }>()
    let updateTimeout: NodeJS.Timeout | null = null
    
    // Debounced batch update function
    const flushUpdates = () => {
      if (updateQueue.size === 0) return
      
      const updates = Array.from(updateQueue.entries())
      updateQueue.clear()
      
      const updateMap = new Map(updates)

      const applyBoostState = <T extends PostWithAuthor>(
        entity: T,
        payload: { count: number; isCurrentUser: boolean; eventType: string },
      ): T => {
        if (!payload.isCurrentUser) {
          return { ...entity, boost_count: payload.count } as T
        }

        let userHasBoosted = entity.user_has_boosted
        let canUnboost = entity.can_unboost

        if (payload.eventType === "INSERT") {
              userHasBoosted = true
              canUnboost = true
        } else if (payload.eventType === "DELETE") {
              userHasBoosted = false
              canUnboost = false
            }

            return {
          ...entity,
          boost_count: payload.count,
              user_has_boosted: userHasBoosted,
          can_unboost: canUnboost,
        } as T
      }

      setPosts((prevPosts) =>
        prevPosts.map((p) => {
          const payload = updateMap.get(p.id)
          if (!payload) return p
          return applyBoostState(p, payload)
        }),
      )

      setCommentsByPostId((prev) => {
        let mutated = false
        const next = { ...prev }

        Object.entries(prev).forEach(([parentId, comments]) => {
          let commentMutated = false
          const updatedComments = comments.map((comment) => {
            let updatedComment = comment
            const commentPayload = updateMap.get(comment.id)
            if (commentPayload) {
              updatedComment = applyBoostState(comment, commentPayload) as HierarchicalPost
              commentMutated = true
              mutated = true
            }

            if (comment.replies && comment.replies.length > 0) {
              let repliesMutated = false
              const updatedReplies = comment.replies.map((reply) => {
                const replyPayload = updateMap.get(reply.id)
                if (!replyPayload) return reply
                repliesMutated = true
                mutated = true
                return applyBoostState(reply, replyPayload)
              })

              if (repliesMutated) {
                updatedComment = {
                  ...updatedComment,
                  replies: updatedReplies,
                }
                commentMutated = true
              }
            }

            return updatedComment
          })

          if (commentMutated) {
            next[parentId] = updatedComments
          }
        })

        return mutated ? next : prev
      })

      const hasCurrentUserUpdate = updates.some(([, payload]) => payload.isCurrentUser)
      if (hasCurrentUserUpdate) {
        setBoostedPostIds(prev => {
          const next = new Set(prev)
          updates.forEach(([postId, payload]) => {
            if (!payload.isCurrentUser) return
            if (payload.eventType === 'INSERT') {
              next.add(postId)
            } else if (payload.eventType === 'DELETE') {
              next.delete(postId)
            }
          })
          return next
        })
      }
    }
    
    // Schedule batch update
    const scheduleUpdate = (postId: string, count: number, isCurrentUser: boolean, eventType: string) => {
      updateQueue.set(postId, { count, isCurrentUser, eventType })
      
      if (updateTimeout) clearTimeout(updateTimeout)
      updateTimeout = setTimeout(flushUpdates, 100) // 100ms debounce
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
          const postId = (payload.new as any)?.post_id || (payload.old as any)?.post_id
          const eventUserId = (payload.new as any)?.user_id || (payload.old as any)?.user_id
          
          if (!postId) return
          
          // Add small delay for DELETE to ensure DB consistency
          if (payload.eventType === 'DELETE') {
            await new Promise(resolve => setTimeout(resolve, 150))
          }
          
          // Fetch updated count
          const { data: count, error } = await supabase.rpc('get_post_boost_count', { p_post_id: postId })
          
          if (error || count === null) return
          
          const isCurrentUser = !!(currentUserId && eventUserId === currentUserId)
          scheduleUpdate(postId, count, isCurrentUser, payload.eventType)
        }
      )
      .subscribe()

    return () => {
      if (updateTimeout) clearTimeout(updateTimeout)
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
          const newPost = payload.new as { depth?: number } | null
          if (!newPost || newPost.depth !== 0) {
            return
          }

          // Increment new posts counter for root-level posts only
          setNewPostsCount(prev => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [community?.id])

  // Load more posts (infinite scroll)
  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMore || posts.length === 0) return

    setIsLoadingMore(true)
    try {
      // Get the last post's created_at for pagination
      const lastPost = [...posts].sort((a, b) => {
        const dateA = new Date(a.published_at || a.created_at).getTime()
        const dateB = new Date(b.published_at || b.created_at).getTime()
        return dateB - dateA
      })[posts.length - 1]

      const lastPostDate = lastPost?.published_at || lastPost?.created_at

      // Fetch next 20 posts
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
        .eq('depth', 0)
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .lt('created_at', lastPostDate || new Date().toISOString())
        .limit(20)

      if (error) {
        console.error('Error loading more posts:', error)
        toast.error('Failed to load more posts')
        return
      }

      if (!newPostsData || newPostsData.length === 0) {
        setHasMore(false)
        return
      }

      // Batch enrich new posts with boost data
      const newPostIds = newPostsData.map(p => p.id)
      
      // Batch fetch boost counts
      const { data: boostCountsData } = await supabase
        .rpc('get_posts_boost_counts', { p_post_ids: newPostIds })

      // Batch fetch user boost status if authenticated
      let userBoostStatus: Array<{ post_id: string; user_has_boosted: boolean; can_unboost: boolean }> = []
      if (user) {
        const { data: boostStatusData } = await supabase
          .rpc('get_user_boosted_posts', { 
            p_post_ids: newPostIds,
            p_user_id: user.id 
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

      // Enrich new posts
      const enrichedNewPosts = newPostsData.map((post) => {
        const boostCount = boostCountMap.get(post.id) || 0
        const boostStatus = boostStatusMap.get(post.id) || { user_has_boosted: false, can_unboost: false }

        return {
          ...post,
          boost_count: boostCount,
          user_has_boosted: boostStatus.user_has_boosted,
          can_unboost: boostStatus.can_unboost
        } as PostWithAuthor
      })

      // Append new posts to existing list
      setPosts(prevPosts => [...prevPosts, ...enrichedNewPosts])

      // Check if there are more posts
      if (enrichedNewPosts.length < 20) {
        setHasMore(false)
      }
    } catch (error: any) {
      console.error('Error loading more posts:', error)
      toast.error('Failed to load more posts')
    } finally {
      setIsLoadingMore(false)
    }
  }

  // Infinite scroll - Intersection Observer
  React.useEffect(() => {
    if (!hasMore || isLoadingMore) return

    const loadMore = () => {
      if (!isLoadingMore && hasMore && posts.length > 0) {
        loadMorePosts()
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0]
        if (firstEntry.isIntersecting) {
          loadMore()
        }
      },
      {
        root: null,
        rootMargin: '200px', // Start loading 200px before reaching the bottom
        threshold: 0.1
      }
    )

    const currentRef = loadMoreRef.current
    if (currentRef) {
      observer.observe(currentRef)
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
    }
  }, [hasMore, isLoadingMore, posts.length])

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
        .eq('depth', 0)
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
          if (user) {
            const { data: userBoostedData } = await supabase
              .rpc('user_boosted_post', {
                p_post_id: post.id,
                p_user_id: user.id
              })
            userHasBoosted = userBoostedData || false
          }

          return {
            ...post,
            boost_count: boostCountData || 0,
            user_has_boosted: userHasBoosted,
            can_unboost: false  // Boosts are now irreversible
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

  const handleBoostToggle = async (
    postId: string,
    postAuthorId: string,
    event: React.MouseEvent<HTMLButtonElement>,
    context?: { parentPostId?: string; parentCommentId?: string },
  ) => {
    if (!user || !userProfile) return
    
    if (postAuthorId === user.id) {
      toast.error("You cannot boost your own post")
      return
    }

    if (boostingPosts.has(postId)) return

    const post = posts.find((p) => p.id === postId)
    const isRootPost = !!post

    let parentPostId = context?.parentPostId
    let parentCommentId = context?.parentCommentId
    let targetComment: HierarchicalPost | undefined
    let targetReply: PostWithAuthor | undefined

    if (!isRootPost) {
      if (!parentPostId) {
        parentPostId = Object.keys(commentsByPostId).find((key) =>
          (commentsByPostId[key] ?? []).some((comment) => {
            if (comment.id === postId) return true
            return comment.replies?.some((reply) => reply.id === postId)
          }),
        )
      }

      if (!parentPostId) {
        toast.error("Unable to find comment context.")
        return
      }

      const commentList = commentsByPostId[parentPostId] ?? []

      if (parentCommentId) {
        targetComment = commentList.find((comment) => comment.id === parentCommentId)
        targetReply = targetComment?.replies?.find((reply) => reply.id === postId)
        if (!targetReply) {
          toast.error("Unable to find reply.")
          return
        }
      } else {
        targetComment = commentList.find((comment) => comment.id === postId)
        if (!targetComment) {
          toast.error("Unable to find comment.")
          return
        }
      }
    }

    const boostSubject: PostWithAuthor | HierarchicalPost | undefined = isRootPost
      ? post
      : targetReply ?? targetComment

    if (!boostSubject) return

    const wasBoosted = boostedPostIds.has(postId)
    const previousBoostCount = boostSubject.boost_count ?? 0

    // Boosts are now irreversible - prevent unboosting
    if (wasBoosted) {
      toast.error("Boosts are permanent and cannot be reversed")
      return
    }

    // Check combined balance (wallet + earnings)
    const availableBalance = (walletBalance ?? 0) + (walletEarningsBalance ?? 0)
    if (availableBalance < 1) {
      toast.error("You need at least 1 point to boost a post")
      return
    }

    if (!wasBoosted && isRootPost) {
      fireGoldConfetti(event.currentTarget as HTMLElement)
      setAnimatingBoosts((prev) => new Set(prev).add(postId))
      setTimeout(() => {
        setAnimatingBoosts((prev) => {
          const next = new Set(prev)
          next.delete(postId)
          return next
        })
      }, 600)
    }

    const nextBoostCount = previousBoostCount + 1

    if (isRootPost) {
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
        p.id === postId
          ? {
              ...p,
              user_has_boosted: true,
                boost_count: nextBoostCount,
                can_unboost: false,
              }
            : p,
        ),
      )
    } else if (parentPostId) {
      setCommentsByPostId((prev) => {
        const existing = prev[parentPostId!] ?? []
        const updated = existing.map((comment) => {
          if (parentCommentId) {
            if (comment.id !== parentCommentId) return comment
            return {
              ...comment,
              replies: (comment.replies ?? []).map((reply) =>
                reply.id === postId
                  ? {
                      ...reply,
                      boost_count: nextBoostCount,
                      user_has_boosted: true,
                      can_unboost: false,
                    }
                  : reply,
              ),
            }
          }

          if (comment.id !== postId) return comment
          return {
            ...comment,
            boost_count: nextBoostCount,
            user_has_boosted: true,
            can_unboost: false,
          }
        })

        return {
          ...prev,
          [parentPostId!]: updated,
        }
      })
    }

    setBoostedPostIds((prev) => {
      const next = new Set(prev)
      next.add(postId)
      return next
    })

    setBoostingPosts((prev) => new Set(prev).add(postId))

    try {
      const { error } = await supabase.rpc("boost_post", {
        p_post_id: postId,
        p_user_id: user.id,
      })

      if (error) throw error

      // Create notification for post author (fire and forget - non-critical)
      if (postAuthorId && postAuthorId !== user.id) {
        void (async () => {
          try {
            // Get booster's profile
            const { data: boosterProfile } = await supabase
              .from("users")
              .select("username, first_name, last_name")
              .eq("id", user.id)
              .single()

            const boosterName = boosterProfile
              ? `${boosterProfile.first_name} ${boosterProfile.last_name}`.trim() || boosterProfile.username
              : "Someone"

            // Get post info for notification link
            const { data: postData } = await supabase
              .from("posts")
              .select("id, community_id, communities!posts_community_id_fkey(slug)")
              .eq("id", postId)
              .single()

            const communitySlug = Array.isArray(postData?.communities) 
              ? postData.communities[0]?.slug 
              : (postData?.communities as any)?.slug
            const postUrl = communitySlug 
              ? `/${communitySlug}/feed?post=${postId}`
              : `/profile/${postAuthorId}`

            // Create notification
            await fetch("/api/notifications/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: postAuthorId,
                type: "post_boost",
                title: "Post boosted!",
                body: `${boosterName} boosted your post`,
                actionUrl: postUrl,
                metadata: {
                  post_id: postId,
                  booster_id: user.id,
                  booster_name: boosterName,
                  booster_username: boosterProfile?.username,
                }
              })
            })
          } catch (error) {
            console.error("[handleBoostToggle] Error creating boost notification:", error)
            // Non-critical error - don't fail the boost
          }
        })()
      }

      toast.success("🚀 Creator boosted! You made their day!")
    } catch (error: any) {
      console.error("Error toggling boost:", error)

      if (isRootPost) {
        setPosts((prevPosts) =>
          prevPosts.map((p) =>
          p.id === postId
            ? {
                ...p,
                user_has_boosted: wasBoosted,
                boost_count: previousBoostCount,
                  can_unboost: false,
                }
              : p,
          ),
        )
      } else if (parentPostId) {
        setCommentsByPostId((prev) => {
          const existing = prev[parentPostId!] ?? []
          const updated = existing.map((comment) => {
            if (parentCommentId) {
              if (comment.id !== parentCommentId) return comment
              return {
                ...comment,
                replies: (comment.replies ?? []).map((reply) =>
                  reply.id === postId
                    ? {
                        ...reply,
                        boost_count: previousBoostCount,
                        user_has_boosted: wasBoosted,
                        can_unboost: false,
                      }
                    : reply,
                ),
              }
            }

            if (comment.id !== postId) return comment
            return {
              ...comment,
              boost_count: previousBoostCount,
              user_has_boosted: wasBoosted,
              can_unboost: false,
            }
          })

          return {
            ...prev,
            [parentPostId!]: updated,
          }
        })
      }

      setBoostedPostIds((prev) => {
        const next = new Set(prev)
        if (wasBoosted) {
          next.add(postId)
        }
        return next
      })
      
      const errorMessage = error?.message || error?.error_description || error?.error || ""
      if (errorMessage.includes("Insufficient balance") || errorMessage.includes("insufficient")) {
        toast.error("You need at least 1 point to boost a post")
      } else if (errorMessage.includes("own post")) {
        toast.error("You cannot boost your own post")
      } else if (errorMessage.includes("already boosted")) {
        toast.error("You have already boosted this post")
      } else if (errorMessage.includes("cannot be reversed") || errorMessage.includes("irreversible")) {
        toast.error("Boosts are permanent and cannot be reversed")
      } else if (errorMessage) {
        toast.error(`Error: ${errorMessage}`)
      } else {
        toast.error("Failed to boost post. Please try again.")
      }
    } finally {
      setBoostingPosts((prev) => {
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

    // Check wallet balance (skip for admins)
    const isAdmin = userProfile?.role === 'admin'
    const availableBalance = (walletBalance ?? 0) + (walletEarningsBalance ?? 0)
    if (!isAdmin && availableBalance < 1) {
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
      let hasVoiceNotes = false
      const isAdmin = userProfile?.role === 'admin'
      
      for (let i = 0; i < newMedia.length; i++) {
        const media = newMedia[i]
        const fileName = `${postId}-${Date.now()}-${i}.${media.file.name.split('.').pop()}`
        const filePath = `${post.community_id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(filePath, media.file, { upsert: false })

        if (uploadError) throw uploadError

        if (media.type === 'audio') {
          hasVoiceNotes = true
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

      // Refresh wallet balance if we added voice notes (only for non-admins, as admins don't have points deducted)
      if (hasVoiceNotes && !isAdmin) {
        await refreshWalletBalance?.()
      }

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

  const openPostComments = React.useCallback(
    (index: number) => {
      if (index < 0 || index >= sortedPosts.length) return
      const targetPost = sortedPosts[index]
      setCommentComposerIndex(index)
      setCommentComposerOpen(targetPost.id)
      loadCommentsForPostIds([targetPost.id])
    },
    [sortedPosts, loadCommentsForPostIds]
  )

  React.useEffect(() => {
    if (!commentComposerOpen) return
    const index = sortedPosts.findIndex((post) => post.id === commentComposerOpen)
    if (index !== -1 && index !== commentComposerIndex) {
      setCommentComposerIndex(index)
    }
  }, [commentComposerOpen, commentComposerIndex, sortedPosts])

  return (
    <TopUpGuard communitySlug={community.slug}>
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        {/* Navigation Tabs */}
        <CommunityNavigation 
          slug={community.slug} 
          isOwner={currentUserId === community.owner_id} 
          isMember={isMember}
          communityOwnerId={community.owner_id}
        />
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
            contentClassName="p-2"
          />
        )}

        {/* Posts List */}
        <div className="space-y-4">
          {sortedPosts.map((post, index) => {
            const isDialogOpen = commentComposerOpen === post.id
            const hasPrev = commentComposerIndex !== null && commentComposerIndex > 0
            const hasNext =
              commentComposerIndex !== null && commentComposerIndex < sortedPosts.length - 1

            const handlePrev = () => {
              if (commentComposerIndex !== null && commentComposerIndex > 0) {
                openPostComments(commentComposerIndex - 1)
              }
            }

            const handleNext = () => {
              if (commentComposerIndex !== null && commentComposerIndex < sortedPosts.length - 1) {
                openPostComments(commentComposerIndex + 1)
              }
            }

            const commentsForPost = commentsByPostId[post.id] ?? []
            const commentsAreLoading = commentsLoading[post.id]
            const replyCount = commentsForPost.reduce(
              (sum, comment) => sum + (comment.replies?.length ?? 0),
              0,
            )
            const totalContributions = commentsForPost.length + replyCount

            return (
              <React.Fragment key={post.id}>
            <Card
              key={post.id}
              data-post-id={post.id}
              className="group bg-white/10 backdrop-blur-md border-0 hover:bg-white/15 transition-colors"
            >
              <CardContent className="p-3">
                {/* Post Header */}
                <div className="flex gap-4 mb-3">
                  {/* Author Avatar */}
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0"
                  >
                    <Avatar 
                      className="h-10 w-10 border-4 border-white/20" 
                      userId={post.author.id}
                      showHoverCard={true}
                      username={post.author.username}
                      firstName={post.author.first_name}
                      lastName={post.author.last_name}
                      profilePicture={post.author.profile_picture}
                      bio={post.author.bio}
                    >
                      <AvatarImage src={post.author.profile_picture} alt={`${post.author.first_name} ${post.author.last_name}`} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm">
                        {post.author.first_name[0]}{post.author.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  {/* Post Info */}
                  <div className="flex items-center gap-2 flex-1">
                    <div className="flex flex-col">
                      <span className="text-white/80 text-sm font-medium">
                        {post.author.first_name} {post.author.last_name}
                      </span>
                      <span className="text-white/40 text-xs" suppressHydrationWarning>
                        {relativeTimes[post.id] ?? formatRelativeTime(post.published_at || post.created_at)}
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
                                  if (currentVoiceNote === newVoiceNote || !('id' in currentVoiceNote)) {
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
                    <p className="text-white/80 text-base whitespace-pre-wrap break-words">
                      {post.content}
                    </p>

                    {/* Post Media Slider */}
                    {post.media && post.media.length > 0 && (
                      <PostMediaSlider 
                        media={post.media} 
                        author={post.author}
                        userHasBoosted={post.user_has_boosted || false}
                        authorId={post.author_id}
                        currentUserId={currentUserId}
                      />
                    )}
                  </>
                )}

                {/* Boost to unlock reward message */}
                {editingPostId !== post.id && post.media?.some(m => m.media_type === 'audio' && m.requires_boost && !post.user_has_boosted && post.author_id !== currentUserId) && (
                  <div className="mt-3 text-center">
                    <p className="text-sm text-white/70">Boost to unlock reward</p>
                  </div>
                )}

                {/* Boost, Contribute, and Save Buttons - Hide when editing */}
                {editingPostId !== post.id && (
                  <div className="flex items-center justify-between gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleBoostToggle(post.id, post.author_id, e)
                        }}
                        disabled={!user || boostingPosts.has(post.id) || post.user_has_boosted}
                        className={`group relative flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          post.user_has_boosted
                            ? "bg-yellow-400/10 border-yellow-400/40"
                            : `bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30 ${
                                topVisiblePostId === post.id ? "animate-shimmer" : ""
                              }`
                        } ${animatingBoosts.has(post.id) ? "animate-boost-pulse" : ""}`}
                      >
                        <Crown
                          className={`h-4 w-4 transition-all ${
                            post.user_has_boosted
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-white/70 group-hover:text-yellow-400"
                          } ${animatingBoosts.has(post.id) ? "animate-boost-icon" : ""}`}
                          style={{
                            filter: post.user_has_boosted
                              ? "drop-shadow(0 0 8px rgba(250, 204, 21, 0.6))"
                              : "none",
                          }}
                        />
                        <span
                          className={`text-xs font-medium transition-colors ${
                            post.user_has_boosted ? "text-yellow-400" : "text-white/70 group-hover:text-white"
                          }`}
                        >
                          {post.user_has_boosted ? "Boosted" : "Boost"}
                        </span>
                        <span
                          className={`text-xs font-semibold transition-colors ${
                            post.user_has_boosted ? "text-yellow-400" : "text-white/70 group-hover:text-white"
                          } ${animatingBoosts.has(post.id) ? "animate-boost-count" : ""}`}
                        >
                          {post.boost_count || 0}
                        </span>
                      </button>

                      {isMember && user && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openPostComments(index)
                          }}
                          className="group relative flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
                        >
                          <Feather className="h-4 w-4 text-white/70 group-hover:text-white/80 transition-all" />
                          <span className="text-xs font-medium text-white/70 group-hover:text-white">
                            Contribute
                          </span>
                          <span className="text-xs font-semibold text-white/60 group-hover:text-white/80">
                            {totalContributions}
                          </span>
                        </button>
                      )}
                    </div>

                    {user && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSaveToggle(post.id)
                        }}
                        disabled={savingPosts.has(post.id)}
                        className={`group relative flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          post.user_has_saved
                            ? "bg-white/10 border-white/30"
                            : "bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
                        }`}
                      >
                        <Bookmark
                          className={`h-4 w-4 transition-all ${
                            post.user_has_saved
                              ? "fill-white/80 text-white/80"
                              : "text-white/70 group-hover:text-white/80"
                          }`}
                        />
                      </button>
                    )}
                  </div>
                )}

              </CardContent>
            </Card>
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                if (!open) {
                  setCommentComposerOpen(null)
                  setCommentComposerIndex(null)
                }
              }}
            >
              <DialogContent
                hideCloseButton
                className="max-w-2xl border border-white/20 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-xl p-0 h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] min-h-[calc(100dvh-1rem)] sm:h-[calc(100vh-4rem)] sm:max-h-[calc(100vh-4rem)] sm:min-h-[calc(100vh-4rem)] sm:max-w-3xl [&>div]:p-0"
              >
                <DialogHeader className="sr-only">
                  <DialogTitle>Post conversation</DialogTitle>
                  <DialogDescription>View the full conversation for this post and add your contribution.</DialogDescription>
                </DialogHeader>
                <div
                  className="flex h-full flex-col overflow-hidden"
                  style={{
                    paddingBottom: "env(safe-area-inset-bottom, 0)",
                    paddingTop: "env(safe-area-inset-top, 0)"
                  }}
                >
                  <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3 rounded-t-lg">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/70 hover:text-white"
                      onClick={() => {
                        setCommentComposerOpen(null)
                        setCommentComposerIndex(null)
                      }}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white/70 hover:text-white"
                        onClick={handlePrev}
                        disabled={!isDialogOpen || !hasPrev}
                        aria-label="Previous post"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white/70 hover:text-white"
                        onClick={handleNext}
                        disabled={!isDialogOpen || !hasNext}
                        aria-label="Next post"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                <div
                  className="relative flex-1 overflow-y-auto px-2 pb-16 space-y-6"
                  style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 4rem)" }}
                >
                    <div className="relative mt-2 border border-white/10 bg-white/5 p-4 space-y-3 rounded-lg shadow-[0_0_30px_rgba(255,255,255,0.25)] ring-1 ring-white/20">
                      <div className="flex items-start gap-3">
                        <div onClick={(e) => e.stopPropagation()}>
                          <Avatar 
                            className="h-9 w-9 border-2 border-white/20 flex-shrink-0" 
                            userId={post.author?.id}
                            showHoverCard={true}
                            username={post.author?.username}
                            firstName={post.author?.first_name}
                            lastName={post.author?.last_name}
                            profilePicture={post.author?.profile_picture}
                            bio={post.author?.bio}
                          >
                            <AvatarImage
                              src={post.author?.profile_picture || ""}
                              alt={`${post.author?.first_name} ${post.author?.last_name}`}
                            />
                            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm">
                              {post.author?.first_name?.[0]}
                              {post.author?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex flex-col">
                          <Link
                            href={`/profile/${post.author.username}`}
                            className="text-white/80 text-sm font-medium hover:text-white"
                          >
                            {post.author.first_name} {post.author.last_name}
                          </Link>
                          <span className="text-white/50 text-xs">
                            {formatRelativeTime(post.created_at)}
                          </span>
                        </div>
                      </div>

                      {post.content && (
                        <p className="text-white/80 text-sm whitespace-pre-wrap">
                          {post.content}
                        </p>
                      )}

                      {post.media && post.media.length > 0 && (
                        <PostMediaSlider 
                          media={post.media} 
                          author={post.author}
                          userHasBoosted={post.user_has_boosted || false}
                          authorId={post.author_id}
                          currentUserId={currentUserId}
                        />
                      )}

                      <div className="flex items-center justify-between gap-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleBoostToggle(post.id, post.author_id, e)
                          }}
                          disabled={!user || boostingPosts.has(post.id)}
                          className={`group relative flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            post.user_has_boosted
                              ? "bg-yellow-400/10 border-yellow-400/40"
                              : `bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30 ${
                                  animatingBoosts.has(post.id) ? "animate-boost-pulse" : ""
                                }`
                          }`}
                        >
                          <Crown
                            className={`h-4 w-4 transition-all ${
                              post.user_has_boosted
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-white/70 group-hover:text-yellow-400"
                            } ${animatingBoosts.has(post.id) ? "animate-boost-icon" : ""}`}
                            style={{
                              filter: post.user_has_boosted
                                ? "drop-shadow(0 0 8px rgba(250, 204, 21, 0.6))"
                                : "none",
                            }}
                          />
                          <span
                            className={`text-xs font-medium transition-colors ${
                              post.user_has_boosted ? "text-yellow-400" : "text-white/70 group-hover:text-white"
                            }`}
                          >
                            {post.user_has_boosted ? "Boosted" : "Boost"}
                          </span>
                          <span
                            className={`text-xs font-semibold transition-colors ${
                              post.user_has_boosted ? "text-yellow-400" : "text-white/70 group-hover:text-white"
                            } ${animatingBoosts.has(post.id) ? "animate-boost-count" : ""}`}
                          >
                            {post.boost_count || 0}
                          </span>
                        </button>

                        <div className="flex items-center gap-1 text-white/60">
                          <Feather className="h-3.5 w-3.5 text-white/70" />
                          <span className="text-xs font-semibold text-white/70">
                            {totalContributions}
                          </span>
                          <span className="text-xs font-medium text-white/60">
                            contributions
                          </span>
                        </div>
                      </div>

                      <div className="h-1" />
                    </div>

                    <div className="mt-0">
                      {isMember ? (
                        <InlinePostComposer
                          communityId={community.id}
                          communitySlug={community.slug}
                          parentPostId={post.id}
                          mode="comment"
                          disableRouterRefresh
                          collapsedLabel="Share something valuable..."
                          onPostCreated={(newComment) => {
                            handleCommentCreated(post.id, newComment)
                            toast.success("Contribution posted!")
                          }}
                        />
                      ) : (
                        <p className="text-white/70 text-sm">
                          You need to be a community member to contribute.
                        </p>
                      )}
                    </div>

                    <div className="mt-6 space-y-4">
                      {commentsAreLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <LoadingSpinner />
                        </div>
                      ) : commentsForPost.length === 0 ? (
                        <p className="text-white/60 text-sm text-center">
                          Be the first to spark this conversation; your brain’s fresh insight sets the tone.
                        </p>
                      ) : (
                        commentsForPost.map((comment) => {
                        const isReplying =
                          activeReplyTarget?.postId === post.id &&
                          activeReplyTarget?.commentId === comment.id
                        const replyCount = comment.replies?.length ?? 0
                        const repliesExpanded = expandedReplies[comment.id] ?? false

                          return (
                            <div
                              key={comment.id}
                              className="rounded-lg bg-white/5 p-4"
                            >
                              <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <Avatar 
                                      className="h-9 w-9 border-2 border-white/20 flex-shrink-0" 
                                      userId={comment.author?.id}
                                      showHoverCard={true}
                                      username={comment.author?.username}
                                      firstName={comment.author?.first_name}
                                      lastName={comment.author?.last_name}
                                      profilePicture={comment.author?.profile_picture}
                                      bio={comment.author?.bio}
                                    >
                                      <AvatarImage
                                        src={comment.author?.profile_picture || ""}
                                        alt={`${comment.author?.first_name} ${comment.author?.last_name}`}
                                      />
                                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm">
                                        {comment.author?.first_name?.[0]}
                                        {comment.author?.last_name?.[0]}
                                      </AvatarFallback>
                                    </Avatar>
                                  </div>
                                  <div className="flex flex-col">
                                    <Link
                                      href={`/profile/${comment.author?.username}`}
                                      className="text-white/80 text-sm font-medium hover:text-white"
                                    >
                                      {comment.author?.first_name} {comment.author?.last_name}
                                    </Link>
                                    <span className="text-white/50 text-xs">
                                      {formatRelativeTime(comment.created_at)}
                                    </span>
                                  </div>
                                </div>

                                {comment.content && (
                                  <p className="text-white/80 text-sm whitespace-pre-wrap">
                                    {comment.content}
                                  </p>
                                )}

                                {comment.media && comment.media.length > 0 && (
                                  <PostMediaSlider 
                                    media={comment.media} 
                                    author={comment.author}
                                    userHasBoosted={comment.user_has_boosted || false}
                                    authorId={comment.author_id}
                                    currentUserId={currentUserId}
                                  />
                                )}

                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleBoostToggle(comment.id, comment.author_id, e, {
                                        parentPostId: post.id,
                                      })
                                    }}
                                    disabled={!user || boostingPosts.has(comment.id)}
                                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                      comment.user_has_boosted
                                        ? "bg-yellow-400/10 border-yellow-400/40"
                                        : "bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
                                    }`}
                                  >
                                    <Crown
                                      className={`h-4 w-4 transition-all ${
                                        comment.user_has_boosted
                                          ? "fill-yellow-400 text-yellow-400"
                                          : "text-white/70 group-hover:text-yellow-300"
                                      }`}
                                    />
                                    <span
                                      className={`text-xs font-medium transition-colors ${
                                        comment.user_has_boosted
                                          ? "text-yellow-400"
                                          : "text-white/70 group-hover:text-white"
                                      }`}
                                    >
                                      {comment.user_has_boosted ? "Boosted" : "Boost"}
                                    </span>
                                    <span className="text-xs font-semibold text-white/70 group-hover:text-white">
                                      {comment.boost_count || 0}
                                    </span>
                                  </button>

                                  {isMember && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setActiveReplyTarget({ postId: post.id, commentId: comment.id })
                                      }}
                                      className="group flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-white/5 text-white/70 hover:text-white hover:border-white/30 transition-all"
                                    >
                                      <Feather className="h-4 w-4" />
                                      <span className="text-xs font-medium">Reply</span>
                                    </button>
                                  )}
                                </div>

                                {isReplying && (
                                  <div className="rounded-lg bg-white/5 p-3">
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault()
                                        submitReply(post.id, comment.id)
                                      }}
                                      className="space-y-3"
                                    >
                                      <Textarea
                                        value={replyContent}
                                        onChange={(e) => setReplyContent(e.target.value)}
                                        placeholder="Share your reply..."
                                        className="min-h-[120px] resize-none border border-white/20 bg-white/5 text-white focus-visible:ring-white/20"
                                        disabled={replySubmitting}
                                      />
                                      {replyError && (
                                        <p className="text-destructive text-xs">{replyError}</p>
                                      )}
                                      <div className="flex justify-end gap-2">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          className="text-white/70 hover:text-white"
                                          onClick={() => setActiveReplyTarget(null)}
                                          disabled={replySubmitting}
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          type="submit"
                                          disabled={replySubmitting}
                                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                                        >
                                          {replySubmitting ? "Posting..." : "Post Reply"}
                                        </Button>
                                      </div>
                                    </form>
                                  </div>
                                )}

                                {replyCount > 0 && (
                                  <div className="space-y-2">
                                    <div>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          toggleRepliesVisibility(comment.id)
                                        }}
                                        className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-white/60 transition-colors hover:border-white/30 hover:text-white"
                                      >
                                        {repliesExpanded ? (
                                          <ChevronDown className="h-3.5 w-3.5 text-white/70" />
                                        ) : (
                                          <ChevronRight className="h-3.5 w-3.5 text-white/70" />
                                        )}
                                      <span>
                                        {repliesExpanded
                                          ? `Hide replies ${replyCount}`
                                          : `View replies ${replyCount}`}
                                      </span>
                                      </button>
                                    </div>

                                    {repliesExpanded && (
                                      <div className="space-y-3 rounded-lg bg-white/5 p-3">
                                        {(comment.replies ?? []).map((reply) => (
                                          <div key={reply.id} className="space-y-2">
                                            <div className="flex items-start gap-3">
                                              <div onClick={(e) => e.stopPropagation()}>
                                                <Avatar 
                                                  className="h-8 w-8 border border-white/20 flex-shrink-0" 
                                                  userId={reply.author?.id}
                                                  showHoverCard={true}
                                                  username={reply.author?.username}
                                                  firstName={reply.author?.first_name}
                                                  lastName={reply.author?.last_name}
                                                  profilePicture={reply.author?.profile_picture}
                                                  bio={reply.author?.bio}
                                                >
                                                  <AvatarImage
                                                    src={reply.author?.profile_picture || ""}
                                                    alt={`${reply.author?.first_name} ${reply.author?.last_name}`}
                                                  />
                                                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-xs">
                                                    {reply.author?.first_name?.[0]}
                                                    {reply.author?.last_name?.[0]}
                                                  </AvatarFallback>
                                                </Avatar>
                                              </div>
                                              <div className="flex flex-col">
                                                <Link
                                                  href={`/profile/${reply.author?.username}`}
                                                  className="text-white/80 text-xs font-medium hover:text-white"
                                                >
                                                  {reply.author?.first_name} {reply.author?.last_name}
                                                </Link>
                                                <span className="text-white/50 text-[10px]">
                                                  {formatRelativeTime(reply.created_at)}
                                                </span>
                                              </div>
                                            </div>

                                            {reply.content && (
                                              <p className="text-white/70 text-sm whitespace-pre-wrap">
                                                {reply.content}
                                              </p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
                <ScrollToTop />
              </DialogContent>
            </Dialog>
            </React.Fragment>
            )
          })}
          
          {/* Infinite Scroll Trigger & Loading Indicator */}
          {sortedPosts.length > 0 && (
            <div ref={loadMoreRef} className="py-8 flex justify-center">
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
    </TopUpGuard>
  )
}