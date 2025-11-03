"use client"

import React, { useState } from "react"
import { Zap, Pin, Crown, Building2, Bookmark, LayoutGrid, TrendingUp } from "lucide-react"
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
  boostedPosts: (Post & { media?: PostMedia[], author?: UserType })[]
  gotBoostedPosts: (Post & { media?: PostMedia[] })[]
  savedPosts: (Post & { media?: PostMedia[], author?: UserType })[]
  communities: Array<{
    id: string
    name: string
    slug: string
    description?: string
    is_active: boolean
    created_at: string
  }>
}

export default function ProfileView({
  user,
  ownedCommunitiesCount,
  memberCommunitiesCount,
  verifiedPaymentsCount,
  posts: initialPosts,
  boostedPosts: initialBoostedPosts,
  gotBoostedPosts: initialGotBoostedPosts,
  savedPosts: initialSavedPosts,
  communities,
}: ProfileViewProps) {
  const { user: currentUser, userProfile, walletBalance } = useAuth()
  const isOwnProfile = currentUser?.id === user.id
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [posts, setPosts] = useState(initialPosts || [])
  const [boostedPosts, setBoostedPosts] = useState(initialBoostedPosts || [])
  const [gotBoostedPosts, setGotBoostedPosts] = useState(initialGotBoostedPosts || [])
  const [savedPosts, setSavedPosts] = useState(initialSavedPosts || [])
  const [savingPosts, setSavingPosts] = useState<Set<string>>(new Set())
  const [boostingPosts, setBoostingPosts] = useState<Set<string>>(new Set())
  const [animatingBoosts, setAnimatingBoosts] = useState<Set<string>>(new Set())

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
    const canUnboost = post.can_unboost

    // Prevent boosting own posts (but allow unboosting if already boosted)
    if (!wasBoosted && postAuthorId === currentUser.id) {
      toast.error("You cannot boost your own post")
      return
    }

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

    // Helper function to update a post in a list
    const updatePostInList = (p: typeof post) => {
      if (p.id === postId) {
        return {
          ...p,
          user_has_boosted: !wasBoosted,
          boost_count: wasBoosted ? previousBoostCount - 1 : previousBoostCount + 1,
          can_unboost: !wasBoosted ? true : false
        }
      }
      return p
    }

    // Optimistic update for posts list
    setPosts(prevPosts => prevPosts.map(updatePostInList))
    setSavedPosts(prevPosts => prevPosts.map(updatePostInList))
    
    // For boostedPosts, add when boosting or remove when unboosting (like savedPosts)
    if (!wasBoosted) {
      // Boosting - add to boostedPosts if not already there (prevent duplicates)
      setBoostedPosts((prev) => {
        // Check if already exists - if so, just update it
        const existingIndex = prev.findIndex(p => p.id === postId)
        if (existingIndex >= 0) {
          // Already exists, update it
          return prev.map((p, idx) => idx === existingIndex ? { ...post, user_has_boosted: true, boost_count: previousBoostCount + 1, can_unboost: true } : p)
        }
        // Not exists, add it
        return [{ ...post, user_has_boosted: true, boost_count: previousBoostCount + 1, can_unboost: true }, ...prev]
      })
    } else {
      // Unboosting - remove from boostedPosts (remove all duplicates just in case)
      setBoostedPosts((prev) => prev.filter(p => p.id !== postId))
    }
    
    // For gotBoostedPosts - handle based on whether this is the profile user's post
    const isProfileUsersPost = post.author_id === user.id
    
    if (isProfileUsersPost) {
      const newCount = wasBoosted ? previousBoostCount - 1 : previousBoostCount + 1
      
      if (newCount === 0) {
        // Remove from gotBoostedPosts when count reaches 0
        setGotBoostedPosts((prev) => prev.filter(p => p.id !== postId))
      } else if (previousBoostCount === 0 && !wasBoosted) {
        // Add to gotBoostedPosts when going from 0 to 1 (first boost)
        setGotBoostedPosts((prev) => {
          const existingIndex = prev.findIndex(p => p.id === postId)
          if (existingIndex >= 0) {
            return prev.map((p, idx) => idx === existingIndex ? { ...post, boost_count: newCount, user_has_boosted: true, can_unboost: true } : p)
          }
          return [...prev, { ...post, boost_count: newCount, user_has_boosted: true, can_unboost: true }]
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
      // Use separate functions for boost/unboost
      const rpcFunction = wasBoosted ? 'unboost_post' : 'boost_post'
      const { data, error } = await supabase.rpc(rpcFunction, {
        p_post_id: postId,
        p_user_id: currentUser.id
      })

      if (error) throw error

      // Show success message
      if (wasBoosted) {
        toast.error("💔 Boost removed... They'll miss your support")
      } else {
        toast.success("🚀 Creator boosted! You made their day!")
      }
    } catch (error: any) {
      console.error('Error toggling boost:', error)
      
      // Revert optimistic update on error
      const revertPost = (p: typeof post) => {
        if (p.id === postId) {
          return {
            ...p,
            user_has_boosted: wasBoosted,
            boost_count: previousBoostCount,
            can_unboost: canUnboost
          }
        }
        return p
      }
      
      setPosts(prevPosts => prevPosts.map(revertPost))
      setSavedPosts(prevPosts => prevPosts.map(revertPost))
      
      // Revert boostedPosts list
      if (!wasBoosted) {
        // Was boosting but failed - remove from boostedPosts
        setBoostedPosts((prev) => prev.filter(p => p.id !== postId))
      } else {
        // Was unboosting but failed - add back to boostedPosts
        setBoostedPosts((prev) => {
          if (prev.find(p => p.id === postId)) return prev // Already there
          return [{ ...post, user_has_boosted: true, boost_count: previousBoostCount, can_unboost: canUnboost }, ...prev]
        })
      }
      
      // Revert gotBoostedPosts list if it's the profile user's post
      const isProfileUsersPost = post.author_id === user.id
      if (isProfileUsersPost) {
        const newCount = wasBoosted ? previousBoostCount - 1 : previousBoostCount + 1
        
        if (!wasBoosted && previousBoostCount === 0) {
          // Was adding to gotBoostedPosts (first boost) but failed - remove it
          setGotBoostedPosts((prev) => prev.filter(p => p.id !== postId))
        } else if (wasBoosted && previousBoostCount === 1) {
          // Was removing from gotBoostedPosts (last boost removed) but failed - add it back
          setGotBoostedPosts((prev) => {
            if (prev.find(p => p.id === postId)) return prev
            return [...prev, { ...post, boost_count: previousBoostCount, user_has_boosted: wasBoosted, can_unboost: canUnboost }]
          })
        } else {
          // Just revert the count
          setGotBoostedPosts(prevPosts => prevPosts.map(revertPost))
        }
      } else {
        // Not profile user's post, just revert if it exists
        setGotBoostedPosts(prevPosts => prevPosts.map(revertPost))
      }
      
      // Show user-friendly error message
      if (error?.message?.includes('balance')) {
        toast.error("Insufficient points to boost this post")
      } else {
        toast.error(error?.message || 'Failed to boost post. Please try again.')
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
                if (p.id === postId) {
                  return {
                    ...p,
                    boost_count: count,
                    user_has_boosted: payload.eventType === 'INSERT',
                    can_unboost: payload.eventType === 'INSERT' ? true : false
                  }
                }
                return p
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

  const PostList = ({ postsToShow }: { postsToShow: (Post & { media?: PostMedia[], author?: UserType })[] }) => {
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
            profile_picture: user.profile_picture
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
                  <Link 
                    href={`/profile/${postAuthor.username}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0"
                  >
                      <Avatar className="h-10 w-10 border-4 border-white/20">
                        <AvatarImage 
                          src={postAuthor?.profile_picture} 
                          alt={`${postAuthor?.first_name} ${postAuthor?.last_name}`} 
                        />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm">
                          {postAuthor?.first_name?.[0] || ''}{postAuthor?.last_name?.[0] || ''}
                        </AvatarFallback>
                      </Avatar>
                    </Link>

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
                                className="text-white/60 hover:text-white/80 text-xs transition-colors"
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
                  
                  {/* Content */}
                  <p className="text-white/80 text-base mb-3">
                    {post.content}
                  </p>

                  {/* Post Media Slider */}
                  {post.media && post.media.length > 0 && (
                    <PostMediaSlider media={post.media} author={post.author} />
                  )}

                  {/* Boost and Save Buttons */}
                  <div className="flex items-center justify-between gap-4 mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleBoostToggle(post.id, post.author_id, e)
                      }}
                      disabled={!currentUser || boostingPosts.has(post.id)}
                      className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
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
          )
        })}
      </div>
    )
  }


  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        {/* Profile Header - TikTok Style */}
        <div className="mb-6">
          <div className="flex flex-col items-center text-center mb-6">
            <Avatar className="h-24 w-24 border-4 border-white/20 mb-4">
                <AvatarImage src={user.profile_picture || ''} alt={user.username} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-3xl">
                  {user.first_name?.[0] || ''}
                  {user.last_name?.[0] || ''}
                </AvatarFallback>
              </Avatar>
            
            <h1 className="text-2xl font-bold text-white mb-2">
                  {user.first_name} {user.last_name}
            </h1>
            
            <p className="text-white/70 text-sm mb-1">@{user.username}</p>
            
                {user.bio && (
              <p className="text-white/80 text-sm max-w-md mx-auto mt-2">
                    {user.bio}
                  </p>
                )}
              </div>

        </div>

        {/* Tabs */}
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="posts" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              <span>All Posts ({posts.length})</span>
            </TabsTrigger>
            {isOwnProfile && (
              <>
                <TabsTrigger value="boosts" className="gap-2">
                  <Zap className="h-4 w-4" />
                  <span>I Boosted ({boostedPosts.length})</span>
                </TabsTrigger>
                <TabsTrigger value="saved" className="gap-2">
                  <Bookmark className="h-4 w-4" />
                  <span>Saved ({savedPosts.length})</span>
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="got-boosted" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              <span>Got Boosted ({gotBoostedPosts.length})</span>
            </TabsTrigger>
            <TabsTrigger value="communities" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span>Communities ({communities.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-4">
            <PostList postsToShow={posts} />
          </TabsContent>

          {isOwnProfile && (
            <>
              <TabsContent value="boosts" className="mt-4">
                <PostList postsToShow={boostedPosts} />
              </TabsContent>

              <TabsContent value="saved" className="mt-4">
                <PostList postsToShow={savedPosts} />
              </TabsContent>
            </>
          )}

          <TabsContent value="got-boosted" className="mt-4">
            <PostList postsToShow={gotBoostedPosts} />
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
                    className="block"
                  >
                    <Card className="group bg-white/10 backdrop-blur-md border-0 hover:bg-white/15 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0">
                            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                              <Building2 className="h-6 w-6 text-white" />
                            </div>
                          </div>
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
