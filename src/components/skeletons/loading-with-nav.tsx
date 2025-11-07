"use client"

import { CommunityNavigation } from "@/components/community-navigation"

interface LoadingWithNavProps {
  slug: string
  isOwner: boolean
  isMember: boolean
  children: React.ReactNode
}

/**
 * Client component that shows navigation immediately while content loads
 * Receives owner/member status from server component
 */
export function LoadingWithNav({ slug, isOwner, isMember, children }: LoadingWithNavProps) {
  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        {/* Navigation Tabs - Show immediately for SPA feel */}
        <CommunityNavigation 
          slug={slug} 
          isOwner={isOwner} 
          isMember={isMember} 
        />
        
        {/* Content skeleton below */}
        {children}
      </div>
    </div>
  )
}

