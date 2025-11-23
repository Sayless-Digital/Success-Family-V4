"use client"

import React, { useMemo, useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Crown, TrendingUp, Clock, Users, Target, Flame, Sparkles, Feather, ArrowLeft, ArrowRight, MoreVertical, Edit, Trash2, Bookmark, LayoutList, Focus, RefreshCw, Hand } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { CommandSearch } from "@/components/command-search"
import { PostMediaSlider } from "@/components/post-media-slider"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { cn, formatRelativeTime } from "@/lib/utils"
import { toast } from "sonner"
import type { PostWithAuthor, HierarchicalPost } from "@/types"
import confetti from "canvas-confetti"
import { InlinePostComposer } from "@/components/inline-post-composer"
import { fetchCommentsForPosts } from "@/lib/api/posts"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/loading-spinner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { FormattedContent } from "@/components/formatted-content"
import type { Community } from "@/types"

const RELATIVE_TIME_REFRESH_INTERVAL = 60_000
const INITIAL_VISIBLE_POSTS = 8
const VISIBLE_POST_INCREMENT = 6
// Focus mode - TikTok style: everything fits in viewport with internal scroll
// Account for: global header (4rem) + search/buttons row (3rem) + spacing (2rem) + mobile bottom nav (4rem)
const SINGLE_VIEW_CONTAINER_HEIGHT = "calc(100dvh - 11rem)"

type TabValue = "for-you" | "trending" | "popular" | "recent" | "new-creators" | "near-payout" | "topic"

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
    user_has_saved?: boolean
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
  currentUserCount: number
  userGoal: number
}

export default function DiscoveryFeedView({
  posts: initialPosts,
  currentUserId,
  initialRelativeTimes,
  payoutMinimumPoints,
  currentUserCount,
  userGoal
}: DiscoveryFeedViewProps) {
  const router = useRouter()
  const { user, walletBalance, walletEarningsBalance, refreshWalletBalance } = useAuth()
  const [activeTab, setActiveTab] = useState<TabValue>(currentUserId ? "for-you" : "trending")
  const [activeTopicSlug, setActiveTopicSlug] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"list" | "single">("list")
  const [currentPostIndex, setCurrentPostIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationDirection, setAnimationDirection] = useState<'next' | 'prev' | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [seenPostIds, setSeenPostIds] = useState<Set<string>>(new Set())
  const [visiblePostCount, setVisiblePostCount] = useState(INITIAL_VISIBLE_POSTS)
  const [showScrollIndicator, setShowScrollIndicator] = useState(false)
  const [isFadingOut, setIsFadingOut] = useState(false)

  // Swipe support for single post view - horizontal swipes (left/right)
  const singlePostContainerRef = React.useRef<HTMLDivElement>(null)
  const touchStartX = React.useRef<number | null>(null)
  const touchEndX = React.useRef<number | null>(null)

  // Initialize from URL params on mount (client-side only to avoid hydration mismatch)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    // Restore topic
    const topicSlug = params.get('topic')
    if (topicSlug) {
      setActiveTab("topic")
      setActiveTopicSlug(topicSlug)
    }

    // Restore view mode
    const viewParam = params.get('view')
    if (viewParam === 'focus' || viewParam === 'single') {
      setViewMode('single')
    }

    setIsInitialized(true)
  }, [])

  // Update URL when topic changes
  React.useEffect(() => {
    if (!isInitialized) return

    const url = new URL(window.location.href)

    // Handle topic
    if (activeTab === "topic" && activeTopicSlug) {
      url.searchParams.set('topic', activeTopicSlug)
    } else {
      url.searchParams.delete('topic')
    }

    window.history.replaceState({}, '', url.toString())
  }, [activeTab, activeTopicSlug, isInitialized])

  const [posts, setPosts] = useState(initialPosts)
  const [relativeTimes, setRelativeTimes] = useState(initialRelativeTimes)
  const [boostingPosts, setBoostingPosts] = useState<Set<string>>(new Set())
  const [animatingBoosts, setAnimatingBoosts] = useState<Set<string>>(new Set())
  const [savingPosts, setSavingPosts] = useState<Set<string>>(new Set())
  const postIdsRef = React.useRef<Set<string>>(new Set(initialPosts.map(p => p.id)))
  const [newPostsCount, setNewPostsCount] = useState(0)
  // If we have 100 posts initially, there might be more
  const [hasMore, setHasMore] = useState(initialPosts.length >= 100)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const loadMoreRef = React.useRef<HTMLDivElement>(null)
  const renderMoreRef = React.useRef<HTMLDivElement>(null)
  const [contributionDialogOpen, setContributionDialogOpen] = useState<string | null>(null)
  const [contributionDialogIndex, setContributionDialogIndex] = useState<number | null>(null)
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, HierarchicalPost[]>>({})
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({})
  const [membershipByCommunityId, setMembershipByCommunityId] = useState<Record<string, boolean>>({})
  const fetchedCommentsRef = React.useRef<Set<string>>(new Set())
  const feedFingerprintRef = React.useRef<string>("")

  // Edit and delete state
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState<Record<string, string>>({})
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // User communities and post composer state
  const [userCommunities, setUserCommunities] = useState<Community[]>([])
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>("")
  const [communitiesLoading, setCommunitiesLoading] = useState(false)
  const [isComposerExpanded, setIsComposerExpanded] = useState(false)

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

  // Helper function to shuffle within buckets for variety
  const shuffleWithinBuckets = useCallback(<T,>(
    sortedArray: T[],
    getScore: (item: T) => number,
    bucketSize: number = 10
  ): T[] => {
    if (sortedArray.length === 0) return sortedArray

    // Create a variety seed that changes with refresh token
    // Use a more varied seed to ensure different shuffles each time
    const varietySeed = refreshToken * 7919 + Date.now()

    // Better seeded random function
    const seededRandom = (seed: number, index: number) => {
      const x = Math.sin((seed + index) * 12.9898) * 43758.5453
      return x - Math.floor(x)
    }

    // Group into buckets by score
    const buckets: T[][] = []
    sortedArray.forEach(item => {
      const score = getScore(item)
      const bucketIndex = Math.floor(score / bucketSize)
      if (!buckets[bucketIndex]) buckets[bucketIndex] = []
      buckets[bucketIndex].push(item)
    })

    // Shuffle within each bucket using Fisher-Yates with seeded random
    const shuffled = buckets.map((bucket, bucketIdx) => {
      if (bucket.length <= 1) return bucket

      const shuffled = [...bucket]
      for (let i = shuffled.length - 1; i > 0; i--) {
        // Use seeded random for more variety - combine seed with bucket index and position
        const randomValue = seededRandom(varietySeed + bucketIdx * 100 + i, i)
        const j = Math.floor(randomValue * (i + 1))
          ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      return shuffled
    }).flat()

    return shuffled
  }, [refreshToken])

  // Sort posts based on active tab
  const sortedPosts = useMemo(() => {
    const postsCopy = [...posts]

    switch (activeTab) {
      case "for-you":
        const forYou = postsCopy
          .filter(p => (p as any).for_you_score !== undefined && (p as any).for_you_score > 0)
          .sort((a, b) => ((b as any).for_you_score || 0) - ((a as any).for_you_score || 0))
        // Use smaller bucket size (5) for more variety
        return shuffleWithinBuckets(forYou, (p) => (p as any).for_you_score || 0, 5)

      case "trending":
        const trending = postsCopy.sort((a, b) => (b.discovery_score || 0) - (a.discovery_score || 0))

        // Separate high-score and low-score posts for variety
        const highScorePosts = trending.filter(p => (p.discovery_score || 0) > 20)
        const lowScorePosts = trending.filter(p => (p.discovery_score || 0) <= 20)

        // Mix: take 70% high-score, 30% low-score (interleaved)
        const mixed: typeof trending = []
        let highIdx = 0
        let lowIdx = 0
        const totalPosts = trending.length
        const lowScoreTarget = Math.ceil(totalPosts * 0.3) // 30% low-score posts

        // First, add some high-score posts
        while (highIdx < highScorePosts.length && mixed.length < totalPosts - lowScoreTarget) {
          mixed.push(highScorePosts[highIdx++])
        }

        // Then interleave low-score posts
        while (lowIdx < lowScorePosts.length && mixed.length < totalPosts) {
          // Add a low-score post
          if (lowIdx < lowScorePosts.length) {
            mixed.push(lowScorePosts[lowIdx++])
          }
          // Add a high-score post if available
          if (highIdx < highScorePosts.length && mixed.length < totalPosts) {
            mixed.push(highScorePosts[highIdx++])
          }
        }

        // Fill remaining with high-score posts
        while (highIdx < highScorePosts.length && mixed.length < totalPosts) {
          mixed.push(highScorePosts[highIdx++])
        }

        return shuffleWithinBuckets(mixed, (p) => {
          const baseScore = p.discovery_score || 0
          const unseenBoost = seenPostIds.has(p.id) ? 0 : 3 // Boost unseen posts by 3 points
          return baseScore + unseenBoost
        }, 3)

      case "popular":
        const popular = postsCopy.sort((a, b) => (b.popular_score || b.boost_count || 0) - (a.popular_score || a.boost_count || 0))

        // Mix high and low boost posts for variety
        const highBoostPosts = popular.filter(p => (p.popular_score || p.boost_count || 0) > 5)
        const lowBoostPosts = popular.filter(p => (p.popular_score || p.boost_count || 0) <= 5)

        const mixedPopular: typeof popular = []
        let highBoostIdx = 0
        let lowBoostIdx = 0
        const totalPopular = popular.length
        const lowBoostTarget = Math.ceil(totalPopular * 0.25) // 25% low-boost posts

        // First, add some high-boost posts
        while (highBoostIdx < highBoostPosts.length && mixedPopular.length < totalPopular - lowBoostTarget) {
          mixedPopular.push(highBoostPosts[highBoostIdx++])
        }

        // Then interleave low-boost posts
        while (lowBoostIdx < lowBoostPosts.length && mixedPopular.length < totalPopular) {
          if (lowBoostIdx < lowBoostPosts.length) {
            mixedPopular.push(lowBoostPosts[lowBoostIdx++])
          }
          if (highBoostIdx < highBoostPosts.length && mixedPopular.length < totalPopular) {
            mixedPopular.push(highBoostPosts[highBoostIdx++])
          }
        }

        // Fill remaining
        while (highBoostIdx < highBoostPosts.length && mixedPopular.length < totalPopular) {
          mixedPopular.push(highBoostPosts[highBoostIdx++])
        }

        return shuffleWithinBuckets(mixedPopular, (p) => p.popular_score || p.boost_count || 0, 3)

      case "recent":
        // For recent, shuffle posts within same day buckets
        const recent = postsCopy.sort((a, b) => (b.created_timestamp || new Date(b.published_at || b.created_at).getTime()) - (a.created_timestamp || new Date(a.published_at || a.created_at).getTime()))
        return shuffleWithinBuckets(recent, (p) => p.created_timestamp || new Date(p.published_at || p.created_at).getTime(), 24 * 60 * 60 * 1000)

      case "new-creators":
        // Soft threshold: prioritize posts from authors with < 20 total boosts
        // Weight by recency and boost count to surface quality new creators
        const newCreators = postsCopy
          .filter(p => {
            const totalBoosts = p.author_total_boosts || 0
            // Soft threshold: gradually decrease priority as author gains more boosts
            return totalBoosts < 20
          })
          .sort((a, b) => {
            // Sort by: recency first, then boost count (to surface quality content)
            const timeA = a.created_timestamp || new Date(a.published_at || a.created_at).getTime()
            const timeB = b.created_timestamp || new Date(b.published_at || b.created_at).getTime()
            const timeDiff = timeB - timeA
            // If posts are within 7 days of each other, prioritize by boost count
            if (Math.abs(timeDiff) < 7 * 24 * 60 * 60 * 1000) {
              return (b.boost_count || 0) - (a.boost_count || 0)
            }
            return timeDiff
          })
        return shuffleWithinBuckets(newCreators, (p) => p.created_timestamp || new Date(p.published_at || p.created_at).getTime(), 24 * 60 * 60 * 1000)

      case "near-payout":
        // Soft threshold: prioritize posts from authors within 30 points of payout
        // Gradually decrease priority as points_to_payout increases
        const nearPayout = postsCopy
          .filter(p => {
            const pointsToPayout = p.points_to_payout || Infinity
            return pointsToPayout > 0 && pointsToPayout <= 30
          })
          .sort((a, b) => {
            // Sort by: points to payout (closest first), then by recency
            const payoutDiff = (a.points_to_payout || Infinity) - (b.points_to_payout || Infinity)
            if (Math.abs(payoutDiff) < 5) {
              // If within 5 points, prioritize by recency
              const timeA = a.created_timestamp || new Date(a.published_at || a.created_at).getTime()
              const timeB = b.created_timestamp || new Date(b.published_at || b.created_at).getTime()
              return timeB - timeA
            }
            return payoutDiff
          })
        return shuffleWithinBuckets(nearPayout, (p) => p.points_to_payout || Infinity, 5)

      case "topic":
        // Filter posts by topic slug
        const topic = postsCopy
          .filter(p => {
            if (!activeTopicSlug) return false
            const postTopics = (p as any).topics || []
            return postTopics.some((pt: any) => pt.topic && pt.topic.slug === activeTopicSlug)
          })
          .sort((a, b) => (b.discovery_score || 0) - (a.discovery_score || 0))
        return shuffleWithinBuckets(topic, (p) => p.discovery_score || 0, 5)

      default:
        return postsCopy
    }
  }, [posts, activeTab, activeTopicSlug, shuffleWithinBuckets])

  // Limit to top 50 posts per tab
  const displayPosts = useMemo(() => {
    return sortedPosts.slice(0, 50)
  }, [sortedPosts])

  const postsToRender = useMemo(() => {
    if (viewMode === "list") {
      return displayPosts.slice(0, Math.min(visiblePostCount, displayPosts.length))
    }
    return displayPosts
  }, [displayPosts, viewMode, visiblePostCount])

  // Restore post index when displayPosts become available
  React.useEffect(() => {
    if (!isInitialized || displayPosts.length === 0) return

    const params = new URLSearchParams(window.location.search)
    const postId = params.get('post')

    if (postId) {
      const index = displayPosts.findIndex(p => p.id === postId)
      if (index !== -1) {
        setCurrentPostIndex(index)
      }
    }
  }, [displayPosts, isInitialized])

  // Update URL when view mode or post changes
  React.useEffect(() => {
    if (!isInitialized || displayPosts.length === 0) return

    const url = new URL(window.location.href)

    // Handle view mode
    if (viewMode === 'single') {
      url.searchParams.set('view', 'focus')
      // Add current post ID if in focus mode
      const currentPost = displayPosts[currentPostIndex]
      if (currentPost) {
        url.searchParams.set('post', currentPost.id)
      }
    } else {
      url.searchParams.delete('view')
      url.searchParams.delete('post')
    }

    window.history.replaceState({}, '', url.toString())
  }, [viewMode, currentPostIndex, displayPosts, isInitialized])

  // Trigger animation when post index changes
  React.useEffect(() => {
    if (viewMode !== "single") return

    // Hide scroll indicator when navigating to a different post
    if (currentPostIndex !== 0) {
      setIsFadingOut(true)
      setTimeout(() => {
        setShowScrollIndicator(false)
        setIsFadingOut(false)
      }, 500) // Fade out duration
    }

    setIsAnimating(true)
    const timer = setTimeout(() => {
      setIsAnimating(false)
      setAnimationDirection(null)
    }, 300)

    return () => clearTimeout(timer)
  }, [currentPostIndex, viewMode])

  // Track which posts have been seen (scrolled into view)
  useEffect(() => {
    if (displayPosts.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const postId = entry.target.getAttribute('data-post-id')
            if (postId) {
              setSeenPostIds(prev => {
                const next = new Set(prev)
                next.add(postId)
                return next
              })
            }
          }
        })
      },
      { threshold: 0.3 } // Trigger when 30% of post is visible
    )

    // Observe all post elements
    const postElements = document.querySelectorAll('[data-post-id]')
    postElements.forEach(el => observer.observe(el))

    return () => {
      observer.disconnect()
    }
  }, [displayPosts])

  // Reset or clamp visible post count when feed changes
  useEffect(() => {
    if (viewMode !== "list") return

    const fingerprint = displayPosts.slice(0, 5).map(post => post.id).join("|")

    setVisiblePostCount(prev => {
      const clampedPrev = Math.min(prev, displayPosts.length || INITIAL_VISIBLE_POSTS)
      if (feedFingerprintRef.current !== fingerprint) {
        feedFingerprintRef.current = fingerprint
        return Math.min(INITIAL_VISIBLE_POSTS, displayPosts.length)
      }
      return clampedPrev
    })
  }, [displayPosts, viewMode])

  // Observer to progressively reveal more posts without server fetch
  useEffect(() => {
    if (viewMode !== "list") return
    if (visiblePostCount >= displayPosts.length) return

    const currentRef = renderMoreRef.current
    if (!currentRef) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting) {
          setVisiblePostCount(prev => {
            if (prev >= displayPosts.length) return prev
            return Math.min(prev + VISIBLE_POST_INCREMENT, displayPosts.length)
          })
        }
      },
      {
        root: null,
        rootMargin: "300px",
        threshold: 0.1,
      }
    )

    observer.observe(currentRef)

    return () => {
      observer.disconnect()
    }
  }, [viewMode, visiblePostCount, displayPosts.length])

  // Reset post index when posts change or view mode changes
  useEffect(() => {
    if (viewMode === "single" && displayPosts.length > 0) {
      setCurrentPostIndex(0)
    }
  }, [displayPosts.length, viewMode])

  // Disable page scroll when in single view mode
  useEffect(() => {
    if (typeof document === "undefined") return
    const html = document.documentElement
    const body = document.body
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = body.style.overflow

    if (viewMode === "single") {
      html.style.overflow = "hidden"
      body.style.overflow = "hidden"
      // Show scroll indicator when entering focus mode
      setShowScrollIndicator(true)
      setIsFadingOut(false)
      // Start fade out after 3.5 seconds, then hide after fade completes
      const fadeOutTimer = setTimeout(() => {
        setIsFadingOut(true)
      }, 3500)
      const hideTimer = setTimeout(() => {
        setShowScrollIndicator(false)
        setIsFadingOut(false)
      }, 4500) // 3.5s + 1s fade out
      return () => {
        clearTimeout(fadeOutTimer)
        clearTimeout(hideTimer)
        html.style.overflow = previousHtmlOverflow || ""
        body.style.overflow = previousBodyOverflow || ""
      }
    } else {
      setShowScrollIndicator(false)
      setIsFadingOut(false)
      html.style.overflow = previousHtmlOverflow || ""
      body.style.overflow = previousBodyOverflow || ""
    }

    return () => {
      html.style.overflow = previousHtmlOverflow || ""
      body.style.overflow = previousBodyOverflow || ""
    }
  }, [viewMode])

  // Keyboard navigation for single post view - left/right arrows
  useEffect(() => {
    if (viewMode !== "single") return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault()
        setAnimationDirection('next')
        setCurrentPostIndex(prev => Math.min(displayPosts.length - 1, prev + 1))
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        setAnimationDirection('prev')
        setCurrentPostIndex(prev => Math.max(0, prev - 1))
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [viewMode, displayPosts.length])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!touchStartX.current || !touchEndX.current) return

    const diff = touchStartX.current - touchEndX.current
    const minSwipeDistance = 50

    if (Math.abs(diff) > minSwipeDistance) {
      if (diff > 0) {
        // Swipe left - next post
        setAnimationDirection('next')
        setCurrentPostIndex(prev => Math.min(displayPosts.length - 1, prev + 1))
      } else {
        // Swipe right - previous post
        setAnimationDirection('prev')
        setCurrentPostIndex(prev => Math.max(0, prev - 1))
      }
    }

    touchStartX.current = null
    touchEndX.current = null
  }, [displayPosts.length])

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

  // Handle boost toggle
  const handleBoostToggle = async (postId: string, authorId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!user) {
      toast.error("Please sign in to boost posts")
      return
    }

    // Check combined balance (wallet + earnings)
    const availableBalance = (walletBalance ?? 0) + (walletEarningsBalance ?? 0)
    if (availableBalance < 1) {
      toast.error("Insufficient points to boost. Please top up your wallet.")
      return
    }

    const post = posts.find(p => p.id === postId)
    if (!post) return

    const wasBoosted = post.user_has_boosted
    const previousBoostCount = post.boost_count || 0

    // Optimistic update
    setBoostingPosts(prev => new Set(prev).add(postId))

    // Boosts are now irreversible - prevent unboosting
    if (wasBoosted) {
      toast.error("Boosts are permanent and cannot be reversed")
      return
    }

    // Fire confetti and set animation BEFORE optimistic update (matching community feed)
    if (!wasBoosted) {
      fireGoldConfetti(e.currentTarget as HTMLElement)
      setAnimatingBoosts(prev => new Set(prev).add(postId))
      setTimeout(() => {
        setAnimatingBoosts(prev => {
          const next = new Set(prev)
          next.delete(postId)
          return next
        })
      }, 600)
    }

    setPosts(prevPosts =>
      prevPosts.map(p => {
        if (p.id !== postId) return p
        return {
          ...p,
          user_has_boosted: true,
          boost_count: previousBoostCount + 1,
          can_unboost: false
        }
      })
    )

    try {
      const { data, error } = await supabase.rpc('boost_post', {
        p_post_id: postId,
        p_user_id: user.id
      })

      if (error) throw error

      // Refresh wallet balance
      await refreshWalletBalance()

      toast.success("🚀 Creator boosted! You made their day!")
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
            can_unboost: false
          }
        })
      )

      const errorMessage = error?.message || ''
      if (errorMessage.includes('cannot be reversed') || errorMessage.includes('irreversible')) {
        toast.error("Boosts are permanent and cannot be reversed")
      } else {
        toast.error(errorMessage || "Failed to boost post. Please try again.")
      }
    } finally {
      setBoostingPosts(prev => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })
    }
  }

  // Fetch saved status for posts
  useEffect(() => {
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

  // Handle save toggle
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

  // Update postIds ref when posts change
  useEffect(() => {
    postIdsRef.current = new Set(posts.map(p => p.id))
  }, [posts])

  // Load more posts (infinite scroll)
  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMore || posts.length === 0) return

    setIsLoadingMore(true)
    try {
      // Get the oldest post's timestamp for pagination
      const oldestPost = [...posts].sort((a, b) => {
        const dateA = new Date(a.published_at || a.created_at).getTime()
        const dateB = new Date(b.published_at || b.created_at).getTime()
        return dateA - dateB
      })[0]

      const oldestPostDate = oldestPost?.published_at || oldestPost?.created_at

      // Fetch next batch of posts
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
          community:communities!posts_community_id_fkey(
            id,
            name,
            slug,
            logo_url
          ),
          media:post_media(
            id,
            media_type,
            storage_path,
            file_name,
            display_order
          )
        `)
        .eq('depth', 0)
        .eq('is_pinned', false)
        .not('published_at', 'is', null)
        .lt('published_at', oldestPostDate)
        .order('published_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error loading more posts:', error)
        toast.error('Failed to load more posts')
        return
      }

      if (!newPostsData || newPostsData.length === 0) {
        setHasMore(false)
        return
      }

      // Filter out posts that already exist
      const existingPostIds = new Set(posts.map(p => p.id))
      const trulyNewPosts = newPostsData.filter(p => !existingPostIds.has(p.id))

      if (trulyNewPosts.length === 0) {
        setHasMore(false)
        return
      }

      // Enrich new posts with discovery feed data (same logic as loadNewPosts)
      const newPostIds = trulyNewPosts.map(p => p.id)
      const newAuthorIds = [...new Set(trulyNewPosts.map(p => p.author_id))]
      const now = new Date()
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      // Parallel fetch all enrichment data
      const [
        boostCountsResult,
        recentBoostsResult,
        authorTotalsResult,
        authorEarningsResult,
        userBoostStatusResult,
        savedStatusResult
      ] = await Promise.all([
        supabase.rpc('get_posts_boost_counts', { p_post_ids: newPostIds }),
        supabase
          .from('post_boosts')
          .select('post_id, created_at')
          .in('post_id', newPostIds)
          .gte('created_at', twentyFourHoursAgo.toISOString()),
        supabase.rpc('get_authors_total_boost_counts', { p_author_ids: newAuthorIds }),
        supabase
          .from('wallets')
          .select('user_id, earnings_points')
          .in('user_id', newAuthorIds),
        user && newPostIds.length > 0
          ? supabase.rpc('get_user_boosted_posts', {
            p_post_ids: newPostIds,
            p_user_id: user.id
          })
          : Promise.resolve({ data: [] }),
        user && newPostIds.length > 0
          ? supabase
            .from('saved_posts')
            .select('post_id')
            .eq('user_id', user.id)
            .in('post_id', newPostIds)
          : Promise.resolve({ data: [] })
      ])

      const boostCountMap = new Map<string, number>(
        (boostCountsResult.data || []).map((b: { post_id: string; boost_count: number }) => [b.post_id, b.boost_count])
      )

      const recentBoostsMap = new Map<string, number>()
        ; (recentBoostsResult.data || []).forEach((b: { post_id: string }) => {
          recentBoostsMap.set(b.post_id, (recentBoostsMap.get(b.post_id) || 0) + 1)
        })

      const authorTotalsMap = new Map<string, number>(
        (authorTotalsResult.data || []).map((a: { author_id: string; total_boost_count: number }) => [a.author_id, Number(a.total_boost_count)])
      )

      const authorEarningsMap = new Map<string, number>(
        (authorEarningsResult.data || []).map((w: { user_id: string; earnings_points: number }) => [w.user_id, Number(w.earnings_points || 0)])
      )

      const boostStatusMap = new Map<string, { user_has_boosted: boolean; can_unboost: boolean }>(
        (userBoostStatusResult.data || []).map((b: { post_id: string; user_has_boosted: boolean; can_unboost: boolean }) => [
          b.post_id,
          { user_has_boosted: b.user_has_boosted, can_unboost: b.can_unboost }
        ])
      )

      const savedPostIds = new Set(
        (savedStatusResult.data || []).map((s: { post_id: string }) => s.post_id)
      )

      // Use payoutMinimumPoints from props
      const minimumPayoutPoints = payoutMinimumPoints

      // Enrich new posts
      const enrichedNewPosts = trulyNewPosts.map(post => {
        const boostCount = boostCountMap.get(post.id) || 0
        const recentBoosts = recentBoostsMap.get(post.id) || 0
        const postDate = new Date(post.published_at || post.created_at)
        const postAgeHours = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60)

        // Improved discovery score with logarithmic decay
        const recentBoostScore = Math.min(recentBoosts * 2, 40)
        const boostScore = Math.min(Math.log10(Math.max(boostCount, 1)) * 10, 40)
        const recencyScore = Math.min(20 / (1 + Math.log(Math.max(postAgeHours, 0.1) + 1)), 20)
        const discoveryScore = recentBoostScore + boostScore + recencyScore

        const authorTotalBoosts = authorTotalsMap.get(post.author_id) || 0
        const authorEarnings = authorEarningsMap.get(post.author_id) || 0
        const pointsToPayout = Math.max(0, minimumPayoutPoints - Number(authorEarnings))
        const isNearPayout = pointsToPayout > 0 && pointsToPayout <= 30

        const communityData = (post as any).community || (post as any).communities

        const boostStatus = boostStatusMap.get(post.id) ?? { user_has_boosted: false, can_unboost: false }

        return {
          ...post,
          boost_count: boostCount,
          discovery_score: discoveryScore,
          recent_boosts: recentBoosts,
          author_total_boosts: authorTotalBoosts,
          is_low_visibility: authorTotalBoosts < 20,
          is_near_payout: isNearPayout,
          points_to_payout: pointsToPayout,
          popular_score: boostCount > 0 ? boostCount / (1 + (postAgeHours / 24) / 30) : 0,
          created_timestamp: postDate.getTime(),
          user_has_boosted: boostStatus.user_has_boosted,
          can_unboost: boostStatus.can_unboost,
          user_has_saved: savedPostIds.has(post.id),
          community: communityData ? {
            id: communityData.id,
            name: communityData.name,
            slug: communityData.slug,
            logo_url: communityData.logo_url
          } : undefined
        } as typeof initialPosts[0]
      })

      // Update postIds ref
      enrichedNewPosts.forEach(post => {
        postIdsRef.current.add(post.id)
      })

      // Append new posts to existing list
      setPosts(prevPosts => [...prevPosts, ...enrichedNewPosts])

      // Update relative times
      const newRelativeTimes: Record<string, string> = {}
      enrichedNewPosts.forEach(post => {
        newRelativeTimes[post.id] = formatRelativeTime(post.published_at || post.created_at)
      })
      setRelativeTimes(prev => ({ ...prev, ...newRelativeTimes }))

      // Check if there are more posts
      if (enrichedNewPosts.length < 50) {
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
  useEffect(() => {
    if (!hasMore || isLoadingMore || posts.length === 0) return

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
        rootMargin: '200px',
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

  // Fetch user communities
  useEffect(() => {
    if (!user) {
      setUserCommunities([])
      setSelectedCommunityId("")
      return
    }

    const fetchUserCommunities = async () => {
      setCommunitiesLoading(true)
      try {
        const { data, error } = await supabase
          .from('community_members')
          .select(`
            community_id,
            communities (
              id,
              name,
              slug,
              description,
              is_active,
              logo_url
            )
          `)
          .eq('user_id', user.id)

        if (error) {
          console.error('Error fetching user communities:', error)
          return
        }

        // Transform the data to extract communities
        const communities = data
          ?.map((item: any) => item.communities)
          .filter(Boolean)
          .filter((c: Community) => c.is_active) || []

        setUserCommunities(communities)

        // Set first community as default if available
        if (communities.length > 0) {
          setSelectedCommunityId(prev => prev || communities[0].id)
        }
      } catch (error) {
        console.error('Error fetching user communities:', error)
      } finally {
        setCommunitiesLoading(false)
      }
    }

    fetchUserCommunities()
  }, [user])

  // Check membership for all unique communities
  useEffect(() => {
    if (!user) {
      setMembershipByCommunityId({})
      return
    }

    const communityIds = [...new Set(posts.map(p => p.community?.id).filter(Boolean) as string[])]
    if (communityIds.length === 0) return

    const checkMemberships = async () => {
      const membershipMap: Record<string, boolean> = {}

      // Check all memberships in parallel
      const membershipChecks = await Promise.all(
        communityIds.map(async (communityId) => {
          const { data: membership } = await supabase
            .from('community_members')
            .select('id')
            .eq('community_id', communityId)
            .eq('user_id', user.id)
            .single()

          return { communityId, isMember: !!membership }
        })
      )

      membershipChecks.forEach(({ communityId, isMember }) => {
        membershipMap[communityId] = isMember
      })

      setMembershipByCommunityId(membershipMap)
    }

    checkMemberships()
  }, [user, posts])

  // Load comments for a post
  const loadCommentsForPost = async (postId: string) => {
    if (fetchedCommentsRef.current.has(postId)) return

    setCommentsLoading(prev => ({ ...prev, [postId]: true }))
    fetchedCommentsRef.current.add(postId)

    try {
      const comments = await fetchCommentsForPosts([postId])
      setCommentsByPostId(prev => ({
        ...prev,
        [postId]: comments[postId] || []
      }))
    } catch (error) {
      console.error('Error loading comments:', error)
      toast.error('Failed to load contributions')
    } finally {
      setCommentsLoading(prev => ({ ...prev, [postId]: false }))
    }
  }

  const openContributionDialog = (postId: string, index: number) => {
    setContributionDialogOpen(postId)
    setContributionDialogIndex(index)
    loadCommentsForPost(postId)
  }

  const handleCommentCreated = (postId: string, newComment: PostWithAuthor) => {
    setCommentsByPostId(prev => {
      const existing = prev[postId] || []
      return {
        ...prev,
        [postId]: [newComment as HierarchicalPost, ...existing]
      }
    })
  }

  // Edit post handler
  const handleEditPost = (post: PostWithAuthor) => {
    setEditingPostId(post.id)
    setEditingContent(prev => ({ ...prev, [post.id]: post.content }))
  }

  // Cancel edit handler
  const handleCancelEdit = (postId: string) => {
    setEditingPostId(null)
    setEditingContent(prev => {
      const updated = { ...prev }
      delete updated[postId]
      return updated
    })
  }

  // Save edit handler
  const handleSaveEdit = async (postId: string) => {
    const content = editingContent[postId]?.trim() || ''

    if (!content) {
      toast.error("Post content cannot be empty")
      return
    }

    setIsSaving(true)

    try {
      const { error } = await supabase
        .from('posts')
        .update({ content })
        .eq('id', postId)

      if (error) throw error

      // Update local state
      setPosts(prevPosts =>
        prevPosts.map(p => p.id === postId ? { ...p, content } : p)
      )

      setEditingPostId(null)
      setEditingContent(prev => {
        const updated = { ...prev }
        delete updated[postId]
        return updated
      })

      toast.success("Post updated successfully")
    } catch (error: any) {
      console.error('Error updating post:', error)
      toast.error('Failed to update post. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Delete post handler
  const handleDeletePost = (postId: string) => {
    setDeletingPostId(postId)
  }

  // Confirm delete handler
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

  // Real-time subscription for new posts from all communities
  useEffect(() => {
    const channel = supabase
      .channel('discovery-new-posts')
      .on(
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
          filter: 'depth=eq.0'
        },
        (payload: any) => {
          const newPost = payload.new as { id?: string; depth?: number; published_at?: string | null; is_pinned?: boolean } | null
          if (!newPost || !newPost.id) {
            return
          }

          // Only count root-level posts
          if (newPost.depth !== 0) {
            return
          }

          // Only count posts that are published and not pinned
          if (!newPost.published_at || newPost.is_pinned) {
            return
          }

          // Check if post already exists in current list
          if (postIdsRef.current.has(newPost.id)) {
            return
          }

          // Increment new posts counter
          setNewPostsCount(prev => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Load new posts when user clicks the notification
  const loadNewPosts = async () => {
    if (!posts.length) return

    try {
      // Get the most recent post timestamp from current posts
      const mostRecentPost = posts.reduce((latest, post) => {
        const postDate = new Date(post.published_at || post.created_at)
        const latestDate = new Date(latest.published_at || latest.created_at)
        return postDate > latestDate ? post : latest
      })

      const mostRecentDate = mostRecentPost.published_at || mostRecentPost.created_at

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
          community:communities!posts_community_id_fkey(
            id,
            name,
            slug,
            logo_url
          ),
          media:post_media(
            id,
            media_type,
            storage_path,
            file_name,
            display_order
          )
        `)
        .eq('depth', 0)
        .eq('is_pinned', false)
        .not('published_at', 'is', null)
        .gt('published_at', mostRecentDate)
        .order('published_at', { ascending: false })
        .limit(50)

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

      // Enrich new posts with discovery feed data
      const newPostIds = trulyNewPosts.map(p => p.id)
      const newAuthorIds = [...new Set(trulyNewPosts.map(p => p.author_id))]
      const now = new Date()
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      // Parallel fetch all enrichment data
      const [
        boostCountsResult,
        recentBoostsResult,
        authorTotalsResult,
        authorEarningsResult,
        userBoostStatusResult
      ] = await Promise.all([
        supabase.rpc('get_posts_boost_counts', { p_post_ids: newPostIds }),
        // Get recent boosts (last 24 hours)
        supabase
          .from('post_boosts')
          .select('post_id, created_at')
          .in('post_id', newPostIds)
          .gte('created_at', twentyFourHoursAgo.toISOString()),
        // Get author total boost counts (for low-visibility detection)
        supabase.rpc('get_authors_total_boost_counts', { p_author_ids: newAuthorIds }),
        // Get author earnings for payout milestone calculation
        supabase
          .from('wallets')
          .select('user_id, earnings_points')
          .in('user_id', newAuthorIds),
        // Get user boost status if authenticated
        user && newPostIds.length > 0
          ? supabase.rpc('get_user_boosted_posts', {
            p_post_ids: newPostIds,
            p_user_id: user.id
          })
          : Promise.resolve({ data: [] })
      ])

      const boostCountMap = new Map<string, number>(
        (boostCountsResult.data || []).map((b: { post_id: string; boost_count: number }) => [b.post_id, b.boost_count])
      )

      const recentBoostsMap = new Map<string, number>()
        ; (recentBoostsResult.data || []).forEach((b: { post_id: string }) => {
          recentBoostsMap.set(b.post_id, (recentBoostsMap.get(b.post_id) || 0) + 1)
        })

      const authorTotalsMap = new Map<string, number>(
        (authorTotalsResult.data || []).map((a: { author_id: string; total_boost_count: number }) => [a.author_id, Number(a.total_boost_count)])
      )

      const authorEarningsMap = new Map<string, number>(
        (authorEarningsResult.data || []).map((w: { user_id: string; earnings_points: number }) => [w.user_id, Number(w.earnings_points || 0)])
      )

      const boostStatusMap = new Map<string, { user_has_boosted: boolean; can_unboost: boolean }>(
        (userBoostStatusResult.data || []).map((b: { post_id: string; user_has_boosted: boolean; can_unboost: boolean }) => [
          b.post_id,
          { user_has_boosted: b.user_has_boosted, can_unboost: b.can_unboost }
        ])
      )

      // Use payoutMinimumPoints from props
      const minimumPayoutPoints = payoutMinimumPoints

      // Enrich new posts
      const enrichedNewPosts = trulyNewPosts.map(post => {
        const boostCount = boostCountMap.get(post.id) || 0
        const recentBoosts = recentBoostsMap.get(post.id) || 0
        const postDate = new Date(post.published_at || post.created_at)
        const postAgeHours = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60)

        // Calculate discovery score: (recent_boosts * 3) + total_boosts + recency_factor
        const recencyFactor = 100 / (postAgeHours + 1)
        const discoveryScore = (recentBoosts * 3) + boostCount + recencyFactor

        // Get author data
        const authorTotalBoosts = authorTotalsMap.get(post.author_id) || 0
        const authorEarnings = authorEarningsMap.get(post.author_id) || 0
        const pointsToPayout = Math.max(0, minimumPayoutPoints - Number(authorEarnings))
        const isNearPayout = pointsToPayout > 0 && pointsToPayout <= 30

        // Extract community data
        const communityData = (post as any).community || (post as any).communities

        // Get user boost status
        const boostStatus = boostStatusMap.get(post.id) ?? { user_has_boosted: false, can_unboost: false }

        return {
          ...post,
          boost_count: boostCount,
          discovery_score: discoveryScore,
          recent_boosts: recentBoosts,
          author_total_boosts: authorTotalBoosts,
          is_low_visibility: authorTotalBoosts < 20,
          is_near_payout: isNearPayout,
          points_to_payout: pointsToPayout,
          popular_score: boostCount > 0 ? boostCount / (1 + (postAgeHours / 24) / 30) : 0,
          created_timestamp: postDate.getTime(),
          user_has_boosted: boostStatus.user_has_boosted,
          can_unboost: boostStatus.can_unboost,
          community: communityData ? {
            id: communityData.id,
            name: communityData.name,
            slug: communityData.slug,
            logo_url: communityData.logo_url
          } : undefined
        } as typeof initialPosts[0]
      })

      // Update postIds ref
      enrichedNewPosts.forEach(post => {
        postIdsRef.current.add(post.id)
      })

      // Prepend new posts to the existing list
      setPosts(prevPosts => [...enrichedNewPosts, ...prevPosts])
      setNewPostsCount(0)

      // Update relative times for new posts
      const newRelativeTimes: Record<string, string> = {}
      enrichedNewPosts.forEach(post => {
        newRelativeTimes[post.id] = formatRelativeTime(post.published_at || post.created_at)
      })
      setRelativeTimes(prev => ({ ...prev, ...newRelativeTimes }))

      toast.success(`Loaded ${enrichedNewPosts.length} new ${enrichedNewPosts.length === 1 ? 'post' : 'posts'}`)
    } catch (error: any) {
      console.error('Error loading new posts:', error)
      toast.error('Failed to load new posts')
    }
  }

  // Calculate progress percentage
  const progressPercentage = userGoal > 0 ? Math.min((currentUserCount / userGoal) * 100, 100) : 0

  // Handle post creation from composer
  const handlePostCreated = async (newPost: PostWithAuthor) => {
    // Refresh the page to get updated posts
    router.refresh()
  }

  // Refresh feed function
  const refreshFeed = useCallback(async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      // Increment refresh token FIRST to trigger immediate shuffle
      // This ensures variety even before server data refreshes
      setRefreshToken(prev => prev + 1)

      // Small delay to allow shuffle to apply to current posts
      await new Promise(resolve => setTimeout(resolve, 50))

      // Refresh server data (this will trigger a re-render with new data)
      router.refresh()

      // After refresh completes, increment token again to shuffle the new data
      setTimeout(() => {
        setRefreshToken(prev => prev + 1)
      }, 200)

      // Additional delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 750))
    } catch (error) {
      console.error('Error refreshing feed:', error)
      toast.error('Failed to refresh feed')
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, router])

  // Get selected community
  const composerCommunityOptions = useMemo(
    () =>
      userCommunities.map((community) => ({
        id: community.id,
        name: community.name,
        slug: community.slug,
        logoUrl: community.logo_url,
      })),
    [userCommunities]
  )
  const selectedCommunity = userCommunities.find(c => c.id === selectedCommunityId)

  // Empty state
  if (displayPosts.length === 0) {
    return (
      <div className="relative w-full overflow-x-hidden overflow-y-visible">
        <div className="relative z-10 space-y-4">
          {/* User Count Display */}
          <div className="bg-white/10 backdrop-blur-2xl border-0 rounded-lg p-2 animate-shimmer-slow">
            <div className="flex items-center justify-center gap-2">
              <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-white/70" />
              </div>
              <span className="text-sm font-semibold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
                {currentUserCount.toLocaleString()}
              </span>
              <span className="text-sm font-medium text-white">Users Signed up</span>
            </div>
          </div>

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

          {/* Post Composer with Community Selector - Only show if user is logged in and has communities */}
          {user && userCommunities.length > 0 && selectedCommunity && (
            <InlinePostComposer
              communityId={selectedCommunity.id}
              communitySlug={selectedCommunity.slug}
              mode="post"
              placeholder="What's on your mind?"
              allowImages={true}
              allowVoiceNote={true}
              initialExpanded={false}
              disableRouterRefresh={true}
              onPostCreated={handlePostCreated}
              onExpandedChange={setIsComposerExpanded}
              contentClassName="p-2"
              communityOptions={composerCommunityOptions}
              selectedCommunityId={selectedCommunityId}
              onCommunityChange={setSelectedCommunityId}
            />
          )}

          <CommandSearch
            activeView={activeTab === "near-payout" ? undefined : activeTab}
            activeTopicId={activeTopicSlug || undefined}
            onSelect={(type, value) => {
              if (type === "topic" && value) {
                setActiveTab("topic")
                setActiveTopicSlug(value)
              } else {
                setActiveTab(type as TabValue)
                setActiveTopicSlug(null)
              }
            }}
          />

          <div className="text-center py-12">
            <p className="text-white/60 text-lg">No posts found in this view</p>
            <p className="text-white/40 text-sm mt-2">Check back later or explore other feeds</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full overflow-x-hidden overflow-y-visible">
      <div className="relative z-10 space-y-4">
        {/* User Count Display - Hidden in single post view */}
        {viewMode === "list" && (
          <div className="bg-white/10 backdrop-blur-2xl border-0 rounded-lg p-2 animate-shimmer-slow">
            <div className="flex items-center justify-center gap-2">
              <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-white/70" />
              </div>
              <span className="text-sm font-semibold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
                {currentUserCount.toLocaleString()}
              </span>
              <span className="text-sm font-medium text-white">Users Signed up</span>
            </div>
          </div>
        )}

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

        <div className="flex items-center gap-2">
          <CommandSearch
            activeView={activeTab === "near-payout" ? undefined : activeTab}
            activeTopicId={activeTopicSlug || undefined}
            onSelect={(type, value) => {
              if (type === "topic" && value) {
                setActiveTab("topic")
                setActiveTopicSlug(value)
              } else {
                setActiveTab(type as TabValue)
                setActiveTopicSlug(null)
              }
            }}
          />
          <button
            onClick={refreshFeed}
            disabled={isRefreshing}
            className={cn(
              "flex items-center justify-center h-9 w-9 rounded-full border transition-all cursor-pointer flex-shrink-0 aspect-square",
              isRefreshing
                ? "bg-white/15 border-white/30 text-white/90"
                : "bg-white/10 border-white/20 text-white/70 hover:bg-white/15 hover:border-white/30 hover:text-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            aria-label="Refresh feed"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </button>
          <button
            onClick={() => {
              setViewMode(viewMode === "list" ? "single" : "list")
              setCurrentPostIndex(0)
            }}
            className={cn(
              "flex items-center justify-center h-9 w-9 rounded-full border transition-all cursor-pointer flex-shrink-0 aspect-square",
              viewMode === "single"
                ? "bg-white/15 border-white/30 text-white/90"
                : "bg-white/10 border-white/20 text-white/70 hover:bg-white/15 hover:border-white/30 hover:text-white/90"
            )}
            aria-label={viewMode === "list" ? "Switch to single post view" : "Switch to list view"}
          >
            {viewMode === "list" ? (
              <Focus className="h-4 w-4" />
            ) : (
              <LayoutList className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="mt-4">
          {viewMode === "single" ? (
            /* Single Post View - TikTok Style */
            <div
              ref={singlePostContainerRef}
              className="flex flex-col"
              style={{
                height: SINGLE_VIEW_CONTAINER_HEIGHT
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Navigation Controls - Fixed at top */}
              {displayPosts.length > 1 && (
                <div className="hidden sm:flex items-center justify-center gap-4 py-2 mb-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      setAnimationDirection('prev')
                      setCurrentPostIndex(prev => Math.max(0, prev - 1))
                    }}
                    disabled={currentPostIndex === 0}
                    className="flex items-center justify-center h-10 w-10 rounded-full bg-white/10 border border-white/20 hover:bg-white/15 hover:border-white/30 transition-all text-white/80 hover:text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Previous post"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>

                  <button
                    onClick={() => {
                      setAnimationDirection('next')
                      setCurrentPostIndex(prev => Math.min(displayPosts.length - 1, prev + 1))
                    }}
                    disabled={currentPostIndex === displayPosts.length - 1}
                    className="flex items-center justify-center h-10 w-10 rounded-full bg-white/10 border border-white/20 hover:bg-white/15 hover:border-white/30 transition-all text-white/80 hover:text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Next post"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
              )}

              {displayPosts.length > 0 ? (
                <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                  {displayPosts.map((post, index) => {
                    const community = post.community || (post as any).communities
                    const isActive = index === currentPostIndex
                    const offset = index - currentPostIndex
                    const isVisible = Math.abs(offset) <= 1

                    return (
                      <div
                        key={post.id}
                        className={cn(
                          "absolute top-0 bottom-0 left-1/2 w-full max-w-2xl rounded-[32px] overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] backdrop-blur-2xl",
                          offset === 0 ? "-translate-x-1/2 opacity-100 scale-100 z-20" :
                            offset > 0 ? "translate-x-[calc(50%+2rem)] opacity-40 scale-90 z-10" :
                              "-translate-x-[calc(150%+2rem)] opacity-40 scale-90 z-10",
                          isActive ? "pointer-events-auto" : "pointer-events-none"
                        )}
                      >
                        {isVisible && (
                          <Card
                            className="group bg-white/10 border-0 w-full h-full flex flex-col overflow-hidden rounded-[32px]"
                            data-post-id={post.id}
                          >
                            <CardContent className="p-3.5 h-full flex flex-col overflow-hidden">
                              {/* Post Header - Fixed */}
                              <div className="flex gap-2 mb-2 flex-shrink-0">
                                <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                                  <Avatar
                                    className="h-11 w-11 border-4 border-white/20"
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
                                <div className="flex items-start gap-2 flex-1">
                                  <div className="flex flex-col flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-white/80 text-base font-medium">
                                        {post.author.first_name} {post.author.last_name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                      <span className="text-white/40 text-sm" suppressHydrationWarning>
                                        {relativeTimes[post.id] ?? formatRelativeTime(post.published_at || post.created_at)}
                                      </span>
                                      {community && (
                                        <>
                                          <span className="text-white/40 text-sm">•</span>
                                          <Link
                                            href={`/${community.slug}/feed`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-white/60 text-sm hover:text-white/80 transition-colors"
                                          >
                                            {community.name} →
                                          </Link>
                                        </>
                                      )}
                                    </div>
                                  </div>
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
                              </div>

                              {/* Tags - Fixed */}
                              <div className="flex items-center gap-1.5 mb-2 flex-wrap flex-shrink-0">
                                {post.is_low_visibility && (
                                  <Badge variant="outline" className="bg-white/10 text-white/70 border-white/20 text-xs">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    <span>New Creator</span>
                                  </Badge>
                                )}
                                {(post.recent_boosts ?? 0) > 0 && (
                                  <Badge variant="outline" className="bg-orange-500/20 text-orange-200 border-orange-500/30 text-xs">
                                    <Flame className="h-3 w-3 mr-1" />
                                    Trending
                                  </Badge>
                                )}
                                {post.is_near_payout && (
                                  <Badge variant="outline" className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30 text-xs">
                                    <Target className="h-3 w-3 mr-1" />
                                    Near Payout
                                  </Badge>
                                )}
                                {post.boost_reward_message && (
                                  <Badge
                                    variant="outline"
                                    className="text-white border-yellow-400/50 relative overflow-hidden text-xs"
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

                              {/* TikTok-style Scrollable Content - Fills remaining space */}
                              <div
                                onScroll={(e) => {
                                  // Hide scroll indicator when user scrolls
                                  if (showScrollIndicator && isActive && !isFadingOut) {
                                    setIsFadingOut(true)
                                    setTimeout(() => {
                                      setShowScrollIndicator(false)
                                      setIsFadingOut(false)
                                    }, 500) // Fade out duration
                                  }
                                }}
                                className="flex-1 min-h-0 overflow-y-auto -mx-3.5 px-3.5 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent relative"
                              >
                                <div className="space-y-2">
                                  {post.content && (
                                    <div>
                                      <FormattedContent
                                        text={post.content}
                                        showLinkPreviews={true}
                                        size="base"
                                      />
                                    </div>
                                  )}

                                  {/* Post Media Slider */}
                                  {post.media && post.media.length > 0 && (
                                    <div>
                                      <PostMediaSlider
                                        media={post.media}
                                        author={post.author}
                                        userHasBoosted={post.user_has_boosted || false}
                                        authorId={post.author_id}
                                        currentUserId={user?.id}
                                      />
                                    </div>
                                  )}

                                  {/* Topic Tags */}
                                  {(post as any).topics && Array.isArray((post as any).topics) && (post as any).topics.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                      {(post as any).topics
                                        .filter((pt: any) => pt.topic)
                                        .map((pt: any) => (
                                          <button
                                            key={pt.topic.id}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setActiveTab("topic")
                                              setActiveTopicSlug(pt.topic.slug)
                                            }}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white/80 transition-colors cursor-pointer"
                                          >
                                            #{(pt.topic as any).label}
                                          </button>
                                        ))}
                                    </div>
                                  )}
                                </div>

                                {/* Scroll Indicator - Shows when entering focus mode */}
                                {showScrollIndicator && isActive && index === 0 && (
                                  <div 
                                    className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
                                    style={{
                                      animation: isFadingOut 
                                        ? 'fade-out 0.5s ease-out forwards'
                                        : 'fade-in 0.5s ease-out forwards'
                                    }}
                                  >
                                    <div className="flex flex-col items-center gap-2 bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-2xl rounded-full px-4 py-3 border border-white/20 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]" style={{ backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)' }}>
                                      <div className="flex items-center gap-2">
                                        <div className="relative flex items-center">
                                          <Hand 
                                            className="h-5 w-5 text-white/80"
                                            style={{
                                              animation: isFadingOut 
                                                ? 'none'
                                                : 'swipe-left 1.5s ease-in-out infinite'
                                            }}
                                          />
                                        </div>
                                        <span className="text-xs font-medium text-white/70 whitespace-nowrap">
                                          Swipe left to navigate
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons - Fixed at bottom */}
                              <div className="flex items-center justify-between gap-2.5 flex-shrink-0 mt-2" style={{
                                paddingTop: '0px',
                                paddingBottom: `env(safe-area-inset-bottom, 0px)`
                              }}>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => handleBoostToggle(post.id, post.author_id, e)}
                                    disabled={!user || boostingPosts.has(post.id) || post.user_has_boosted}
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

                                  {community && user && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        openContributionDialog(post.id, index)
                                      }}
                                      className="group relative flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
                                    >
                                      <Feather className="h-4 w-4 text-white/70 group-hover:text-white/80 transition-all" />
                                      <span className="text-xs font-medium text-white/70 group-hover:text-white">
                                        Contribute
                                      </span>
                                      <span className="text-xs font-semibold text-white/60 group-hover:text-white/80">
                                        {(commentsByPostId[post.id]?.length || 0) + (commentsByPostId[post.id]?.reduce((sum, c) => sum + (c.replies?.length || 0), 0) || 0)}
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
                                    className={`group relative flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${post.user_has_saved
                                      ? "bg-white/10 border-white/30"
                                      : "bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
                                      }`}
                                  >
                                    <Bookmark
                                      className={`h-4 w-4 transition-all ${post.user_has_saved
                                        ? "fill-white/80 text-white/80"
                                        : "text-white/70 group-hover:text-white/80"
                                        }`}
                                    />
                                  </button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-white/60 text-lg">No posts to display</p>
                </div>
              )}
            </div>
          ) : (
            /* List View - Default */
            <div className="space-y-4">
              {/* Post Composer with Community Selector - Only show if user is logged in and has communities */}
              {user && userCommunities.length > 0 && selectedCommunity && (
                <InlinePostComposer
                  communityId={selectedCommunity.id}
                  communitySlug={selectedCommunity.slug}
                  mode="post"
                  placeholder="Write something valuable"
                  allowImages={true}
                  allowVoiceNote={true}
                  initialExpanded={false}
                  disableRouterRefresh={true}
                  onPostCreated={handlePostCreated}
                  onExpandedChange={setIsComposerExpanded}
                  contentClassName="p-2"
                  communityOptions={composerCommunityOptions}
                  selectedCommunityId={selectedCommunityId}
                  onCommunityChange={setSelectedCommunityId}
                />
              )}
              {postsToRender.map((post) => {
                const community = post.community || (post as any).communities

                return (
                  <Card
                    key={post.id}
                    data-post-id={post.id}
                    className="group bg-white/10 backdrop-blur-2xl border-0 hover:bg-white/15 transition-colors"
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
                        <div className="flex items-start gap-2 flex-1">
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white/80 text-sm font-medium">
                                {post.author.first_name} {post.author.last_name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-white/40 text-xs" suppressHydrationWarning>
                                {relativeTimes[post.id] ?? formatRelativeTime(post.published_at || post.created_at)}
                              </span>
                              {community && (
                                <>
                                  <span className="text-white/40 text-xs">•</span>
                                  <Link
                                    href={`/${community.slug}/feed`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-white/60 text-xs hover:text-white/80 transition-colors"
                                  >
                                    {community.name} →
                                  </Link>
                                </>
                              )}
                            </div>
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
                      </div>

                      {/* Tags - Below Header, Above Content */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        {post.is_low_visibility && (
                          <Badge variant="outline" className="bg-white/10 text-white/70 border-white/20 text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            <span>New Creator</span>
                          </Badge>
                        )}
                        {(post.recent_boosts ?? 0) > 0 && (
                          <Badge variant="outline" className="bg-orange-500/20 text-orange-200 border-orange-500/30 text-xs">
                            <Flame className="h-3 w-3 mr-1" />
                            Trending
                          </Badge>
                        )}
                        {post.is_near_payout && (
                          <Badge variant="outline" className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30 text-xs">
                            <Target className="h-3 w-3 mr-1" />
                            Near Payout
                          </Badge>
                        )}
                        {post.boost_reward_message && (
                          <Badge
                            variant="outline"
                            className="text-white border-yellow-400/50 relative overflow-hidden text-xs"
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
                        <div className="mb-3 space-y-3">
                          <Textarea
                            value={editingContent[post.id] || ''}
                            onChange={(e) => setEditingContent(prev => ({ ...prev, [post.id]: e.target.value }))}
                            placeholder="Write something valuable"
                            className="w-full bg-white/10 border-white/20 text-white placeholder:text-white/40 resize-none focus:ring-white/20 min-h-[100px]"
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement
                              target.style.height = 'auto'
                              target.style.height = Math.max(100, target.scrollHeight) + 'px'
                            }}
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => handleSaveEdit(post.id)}
                              disabled={isSaving}
                              size="sm"
                              className="bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                              {isSaving ? "Saving..." : "Save"}
                            </Button>
                            <Button
                              onClick={() => handleCancelEdit(post.id)}
                              disabled={isSaving}
                              size="sm"
                              variant="outline"
                              className="border-white/20 text-white hover:bg-white/10"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mb-3">
                              <FormattedContent
                                text={post.content}
                                showLinkPreviews={true}
                                size="base"
                              />

                            {/* Post Media Slider */}
                            {post.media && post.media.length > 0 && (
                              <div className="mt-3">
                                <PostMediaSlider
                                  media={post.media}
                                  author={post.author}
                                  userHasBoosted={post.user_has_boosted || false}
                                  authorId={post.author_id}
                                  currentUserId={user?.id}
                                />
                              </div>
                            )}

                            {/* Topic Tags */}
                            {(post as any).topics && Array.isArray((post as any).topics) && (post as any).topics.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {(post as any).topics
                                  .filter((pt: any) => pt.topic)
                                  .map((pt: any) => (
                                    <button
                                      key={pt.topic.id}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setActiveTab("topic")
                                        setActiveTopicSlug(pt.topic.slug)
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white/80 transition-colors cursor-pointer"
                                    >
                                      #{(pt.topic as any).label}
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>

                          {/* Boost, Contribute, and Save Buttons */}
                          <div className="flex items-center justify-between gap-4 mt-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => handleBoostToggle(post.id, post.author_id, e)}
                                disabled={!user || boostingPosts.has(post.id) || post.user_has_boosted}
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

                              {community && user && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openContributionDialog(post.id, displayPosts.findIndex(p => p.id === post.id))
                                  }}
                                  className="group relative flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
                                >
                                  <Feather className="h-4 w-4 text-white/70 group-hover:text-white/80 transition-all" />
                                  <span className="text-xs font-medium text-white/70 group-hover:text-white">
                                    Contribute
                                  </span>
                                  <span className="text-xs font-semibold text-white/60 group-hover:text-white/80">
                                    {(commentsByPostId[post.id]?.length || 0) + (commentsByPostId[post.id]?.reduce((sum, c) => sum + (c.replies?.length || 0), 0) || 0)}
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
                                className={`group relative flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${post.user_has_saved
                                  ? "bg-white/10 border-white/30"
                                  : "bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
                                  }`}
                              >
                                <Bookmark
                                  className={`h-4 w-4 transition-all ${post.user_has_saved
                                    ? "fill-white/80 text-white/80"
                                    : "text-white/70 group-hover:text-white/80"
                                    }`}
                                />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )
              })}

              {viewMode === "list" && visiblePostCount < displayPosts.length && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div ref={renderMoreRef} className="h-4 w-full" aria-hidden />
                  <p className="text-white/60 text-sm">Loading more posts...</p>
                  <Button
                    type="button"
                    onClick={() =>
                      setVisiblePostCount(prev =>
                        Math.min(prev + VISIBLE_POST_INCREMENT * 2, displayPosts.length)
                      )
                    }
                    className="border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
                    variant="outline"
                  >
                    Show more posts
                  </Button>
                </div>
              )}

              {/* Load More Trigger - Intersection Observer Target */}
              {hasMore && (
                <div ref={loadMoreRef} className="h-4 w-full" />
              )}

              {/* Loading Spinner */}
              {isLoadingMore && (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Contribution Dialog */}
      {contributionDialogOpen && contributionDialogIndex !== null && (() => {
        const post = displayPosts[contributionDialogIndex]
        if (!post) return null
        const community = post.community || (post as any).communities
        const isDialogOpen = contributionDialogOpen === post.id
        const hasPrev = contributionDialogIndex > 0
        const hasNext = contributionDialogIndex < displayPosts.length - 1
        const commentsForPost = commentsByPostId[post.id] ?? []
        const commentsAreLoading = commentsLoading[post.id]
        const replyCount = commentsForPost.reduce((sum, comment) => sum + (comment.replies?.length ?? 0), 0)
        const totalContributions = commentsForPost.length + replyCount
        const isMember = community ? membershipByCommunityId[community.id] : false

        const handlePrev = () => {
          if (contributionDialogIndex > 0) {
            const prevPost = displayPosts[contributionDialogIndex - 1]
            openContributionDialog(prevPost.id, contributionDialogIndex - 1)
          }
        }

        const handleNext = () => {
          if (contributionDialogIndex < displayPosts.length - 1) {
            const nextPost = displayPosts[contributionDialogIndex + 1]
            openContributionDialog(nextPost.id, contributionDialogIndex + 1)
          }
        }

        return (
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                setContributionDialogOpen(null)
                setContributionDialogIndex(null)
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
                      setContributionDialogOpen(null)
                      setContributionDialogIndex(null)
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
                        <FormattedContent
                          text={post.content}
                          showLinkPreviews={true}
                          size="sm"
                        />
                    )}

                    {post.media && post.media.length > 0 && (
                      <PostMediaSlider
                        media={post.media}
                        author={post.author}
                        userHasBoosted={post.user_has_boosted || false}
                        authorId={post.author_id}
                        currentUserId={user?.id}
                      />
                    )}

                    {(post as any).topics && Array.isArray((post as any).topics) && (post as any).topics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {(post as any).topics
                          .filter((pt: any) => pt.topic)
                          .map((pt: any) => (
                            <span
                              key={pt.topic.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white/80 transition-colors"
                            >
                              #{(pt.topic as any).label}
                            </span>
                          ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleBoostToggle(post.id, post.author_id, e)
                        }}
                        disabled={!user || boostingPosts.has(post.id) || post.user_has_boosted}
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
                    {community ? (
                      <>
                        <InlinePostComposer
                          communityId={community.id}
                          communitySlug={community.slug}
                          parentPostId={post.id}
                          mode="comment"
                          disableRouterRefresh
                          collapsedLabel="Share something valuable..."
                          disabled={!isMember}
                          onPostCreated={(newComment) => {
                            handleCommentCreated(post.id, newComment)
                            toast.success("Contribution posted!")
                          }}
                        />
                        {!isMember && (
                          <p className="text-white/60 text-xs mt-2 px-2">
                            Join the community to contribute
                          </p>
                        )}
                      </>
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
                        Be the first to spark this conversation; your brain's fresh insight sets the tone.
                      </p>
                    ) : (
                      commentsForPost.map((comment) => (
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
                                <FormattedContent
                                  text={comment.content}
                                  showLinkPreviews={true}
                                  size="sm"
                                  previewCompact={true}
                                />
                            )}

                            {comment.media && comment.media.length > 0 && (
                              <PostMediaSlider
                                media={comment.media}
                                author={comment.author}
                                userHasBoosted={comment.user_has_boosted || false}
                                authorId={comment.author_id}
                                currentUserId={user?.id}
                              />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )
      })()}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingPostId} onOpenChange={(open) => !open && !isDeleting && setDeletingPostId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader className="space-y-2">
            <DialogTitle>Delete Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingPostId(null)}
              disabled={isDeleting}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
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

