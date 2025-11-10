"use client"

import React from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Home, MessageSquare, Video, VideoIcon, Users, Shield, ListMusic } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTopupCheck } from "@/hooks/use-topup-check"

interface CommunityNavigationProps {
  slug: string
  isOwner?: boolean
  isMember?: boolean
}

/**
 * Shared navigation component for all community pages
 * Displays tabs for Home, Feed, Events, Recordings (if owner/member), Members, Settings (if owner/member)
 */
export function CommunityNavigation({ slug, isOwner = false, isMember = false }: CommunityNavigationProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { needsTopup } = useTopupCheck()
  
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
          {(isOwner || isMember) && (
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
          {(isOwner || isMember) && (
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
  )
}
