"use client"

import React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Home, MessageSquare, Video, VideoIcon, Users, Shield, ListMusic } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

  return (
    <Tabs value={getActiveTab} className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="home" asChild>
          <Link href={`/${slug}`} className="flex items-center gap-2 touch-feedback" prefetch={true}>
            <Home className="h-4 w-4" />
            Home
          </Link>
        </TabsTrigger>
        <TabsTrigger value="feed" asChild>
          <Link href={`/${slug}/feed`} className="flex items-center gap-2 touch-feedback" prefetch={true}>
            <MessageSquare className="h-4 w-4" />
            Feed
          </Link>
        </TabsTrigger>
        <TabsTrigger value="events" asChild>
          <Link href={`/${slug}/events`} className="flex items-center gap-2 touch-feedback" prefetch={true}>
            <Video className="h-4 w-4" />
            Events
          </Link>
        </TabsTrigger>
        {(isOwner || isMember) && (
          <>
            <TabsTrigger value="videos" asChild>
              <Link href={`/${slug}/videos`} className="flex items-center gap-2 touch-feedback" prefetch={true}>
                <VideoIcon className="h-4 w-4" />
                Videos
              </Link>
            </TabsTrigger>
            <TabsTrigger value="playlists" asChild>
              <Link href={`/${slug}/playlists`} className="flex items-center gap-2 touch-feedback" prefetch={true}>
                <ListMusic className="h-4 w-4" />
                Playlists
              </Link>
            </TabsTrigger>
          </>
        )}
        <TabsTrigger value="members" asChild>
          <Link href={`/${slug}/members`} className="flex items-center gap-2 touch-feedback" prefetch={true}>
            <Users className="h-4 w-4" />
            Members
          </Link>
        </TabsTrigger>
        {(isOwner || isMember) && (
          <TabsTrigger value="settings" asChild>
            <Link href={`/${slug}/settings`} className="flex items-center gap-2 touch-feedback" prefetch={true}>
              <Shield className="h-4 w-4" />
              Settings
            </Link>
          </TabsTrigger>
        )}
      </TabsList>
    </Tabs>
  )
}






