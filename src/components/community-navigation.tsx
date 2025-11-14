"use client"

import React from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Home, MessageSquare, Video, VideoIcon, Users, Shield, ListMusic } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTopupCheck } from "@/hooks/use-topup-check"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"

interface CommunityNavigationProps {
  slug: string
  isOwner?: boolean
  isMember?: boolean
  communityOwnerId?: string
}

/**
 * Shared navigation component for all community pages
 * Displays tabs for Home, Feed, Events, Recordings (if owner/member), Members, Settings (if owner only)
 */
export function CommunityNavigation({ slug, isOwner: propIsOwner, isMember: propIsMember, communityOwnerId }: CommunityNavigationProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { needsTopup } = useTopupCheck()
  const { user, isLoading: authLoading } = useAuth()
  
  // Track permissions - start as null (unknown) to prevent flash
  const [permissions, setPermissions] = React.useState<{ isOwner: boolean; isMember: boolean } | null>(null)
  const prevSlugRef = React.useRef(slug)
  const communityIdRef = React.useRef<string | null>(null)
  
  // Use useLayoutEffect to synchronously determine permissions before paint
  React.useLayoutEffect(() => {
    // Reset when slug changes
    if (prevSlugRef.current !== slug) {
      prevSlugRef.current = slug
      setPermissions(null)
      communityIdRef.current = null
    }
    
    // If auth is still loading, don't show anything yet
    if (authLoading) {
      setPermissions(null)
      return
    }
    
    // If we have props, use them immediately (they come from server)
    if (propIsOwner !== undefined || propIsMember !== undefined) {
      setPermissions({
        isOwner: propIsOwner === true,
        isMember: propIsMember === true || propIsOwner === true
      })
      return
    }
    
    // Otherwise, we need to fetch - but don't show tabs until we know
    if (user && communityOwnerId) {
      const isOwner = communityOwnerId === user.id
      setPermissions({
        isOwner,
        isMember: isOwner // If owner, always member - will check actual membership in useEffect
      })
    } else {
      // No user or no ownerId - definitely not owner/member
      setPermissions({
        isOwner: false,
        isMember: false
      })
    }
  }, [slug, user, authLoading, propIsOwner, propIsMember, communityOwnerId])
  
  // Fetch membership if we don't have it yet
  React.useEffect(() => {
    if (authLoading || permissions !== null || !user || !communityOwnerId) return
    
    let isMounted = true
    
    const checkMembership = async () => {
      try {
        // Get community ID if we don't have it
        let communityId = communityIdRef.current
        if (!communityId) {
          const { data: community } = await supabase
            .from('communities')
            .select('id')
            .eq('slug', slug)
            .maybeSingle()
          
          if (community) {
            communityId = community.id
            communityIdRef.current = communityId
          }
        }
        
        if (!communityId) return
        
        // Check membership
        const { data: membership } = await supabase
          .from('community_members')
          .select('id')
          .eq('community_id', communityId)
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (isMounted) {
          const isOwner = communityOwnerId === user.id
          setPermissions({
            isOwner,
            isMember: isOwner || !!membership
          })
        }
      } catch (error) {
        console.error('Error checking membership:', error)
        if (isMounted) {
          const isOwner = communityOwnerId === user.id
          setPermissions({
            isOwner,
            isMember: isOwner
          })
        }
      }
    }
    
    checkMembership()
    
    return () => {
      isMounted = false
    }
  }, [slug, user, authLoading, communityOwnerId, permissions])
  
  // Determine what to show - only show restricted tabs once we have confirmed permissions
  const showSettings = permissions?.isOwner === true
  const showVideosPlaylists = permissions?.isOwner === true || permissions?.isMember === true
  
  // Determine active tab based on pathname
  const getActiveTab = React.useMemo(() => {
    if (pathname === `/${slug}` || pathname === `/${slug}/`) return "home"
    if (pathname === `/${slug}/feed`) return "feed"
    if (pathname === `/${slug}/events`) return "events"
    if (pathname === `/${slug}/videos`) return "videos"
    if (pathname === `/${slug}/playlists`) return "playlists"
    if (pathname === `/${slug}/members`) return "members"
    if (pathname === `/${slug}/settings`) return "settings"
    return "home"
  }, [pathname, slug])

  const handleRestrictedClick = (e: React.MouseEvent, targetPath: string) => {
    if (needsTopup) {
      e.preventDefault()
      const returnUrl = encodeURIComponent(targetPath)
      router.push(`/topup?returnUrl=${returnUrl}`)
    }
  }

  return (
    <div className="w-full">
      <Tabs value={getActiveTab} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="home" asChild>
            <Link href={`/${slug}`} className="flex items-center gap-2 touch-feedback" prefetch={true}>
              <Home className="h-4 w-4" />
              Home
            </Link>
          </TabsTrigger>
          <TabsTrigger value="feed" asChild disabled={needsTopup}>
            <Link 
              href={needsTopup ? '#' : `/${slug}/feed`} 
              className="flex items-center gap-2 touch-feedback" 
              prefetch={!needsTopup}
              onClick={(e) => handleRestrictedClick(e, `/${slug}/feed`)}
            >
              <MessageSquare className="h-4 w-4" />
              Feed
            </Link>
          </TabsTrigger>
          <TabsTrigger value="events" asChild disabled={needsTopup}>
            <Link 
              href={needsTopup ? '#' : `/${slug}/events`} 
              className="flex items-center gap-2 touch-feedback" 
              prefetch={!needsTopup}
              onClick={(e) => handleRestrictedClick(e, `/${slug}/events`)}
            >
              <Video className="h-4 w-4" />
              Events
            </Link>
          </TabsTrigger>
          {permissions !== null && showVideosPlaylists && (
            <>
              <TabsTrigger value="videos" asChild disabled={needsTopup}>
                <Link 
                  href={needsTopup ? '#' : `/${slug}/videos`} 
                  className="flex items-center gap-2 touch-feedback" 
                  prefetch={!needsTopup}
                  onClick={(e) => handleRestrictedClick(e, `/${slug}/videos`)}
                >
                  <VideoIcon className="h-4 w-4" />
                  Videos
                </Link>
              </TabsTrigger>
              <TabsTrigger value="playlists" asChild disabled={needsTopup}>
                <Link 
                  href={needsTopup ? '#' : `/${slug}/playlists`} 
                  className="flex items-center gap-2 touch-feedback" 
                  prefetch={!needsTopup}
                  onClick={(e) => handleRestrictedClick(e, `/${slug}/playlists`)}
                >
                  <ListMusic className="h-4 w-4" />
                  Playlists
                </Link>
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="members" asChild disabled={needsTopup}>
            <Link 
              href={needsTopup ? '#' : `/${slug}/members`} 
              className="flex items-center gap-2 touch-feedback" 
              prefetch={!needsTopup}
              onClick={(e) => handleRestrictedClick(e, `/${slug}/members`)}
            >
              <Users className="h-4 w-4" />
              Members
            </Link>
          </TabsTrigger>
          {permissions !== null && showSettings && (
            <TabsTrigger value="settings" asChild disabled={needsTopup}>
              <Link 
                href={needsTopup ? '#' : `/${slug}/settings`} 
                className="flex items-center gap-2 touch-feedback" 
                prefetch={!needsTopup}
                onClick={(e) => handleRestrictedClick(e, `/${slug}/settings`)}
              >
                <Shield className="h-4 w-4" />
                Settings
              </Link>
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>
    </div>
  )
}
