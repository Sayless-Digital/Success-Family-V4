"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { LoadingWithNav } from "./loading-with-nav"

interface LoadingWithNavServerProps {
  children: React.ReactNode
}

/**
 * Client component that extracts slug from pathname and fetches owner/member status
 * Shows navigation immediately while checking status in the background
 */
export function LoadingWithNavServer({ children }: LoadingWithNavServerProps) {
  const pathname = usePathname()
  const [isOwner, setIsOwner] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  // Extract slug from pathname (e.g., /my-community/feed -> my-community)
  const slug = pathname?.split('/').filter(Boolean)[0] || ''

  useEffect(() => {
    if (!slug) {
      setIsLoading(false)
      return
    }

    // Fetch owner/member status
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/community-status?slug=${encodeURIComponent(slug)}`)
        if (response.ok) {
          const data = await response.json()
          setIsOwner(data.isOwner || false)
          setIsMember(data.isMember || false)
        }
      } catch (error) {
        console.error('Error fetching community status:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStatus()
  }, [slug])

  // Show navigation immediately (optimistically show all tabs during loading)
  // This gives instant SPA feel, and the actual page will have correct tabs
  return (
    <LoadingWithNav 
      slug={slug} 
      isOwner={isLoading ? true : isOwner} 
      isMember={isLoading ? true : isMember}
    >
      {children}
    </LoadingWithNav>
  )
}

