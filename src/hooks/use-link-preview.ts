"use client"

import { useState, useEffect, useRef } from "react"
import type { LinkPreview } from "@/app/api/link-preview/route"

interface UseLinkPreviewOptions {
  debounceMs?: number
  enabled?: boolean
}

/**
 * Hook to fetch link previews with debouncing
 * Perfect for real-time preview while typing
 */
export function useLinkPreview(
  url: string | null,
  options: UseLinkPreviewOptions = {}
) {
  const { debounceMs = 500, enabled = true } = options
  const [preview, setPreview] = useState<LinkPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Cache to avoid refetching same URL
  const cacheRef = useRef<Map<string, LinkPreview>>(new Map())
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Reset states if no URL
    if (!url || !enabled) {
      setPreview(null)
      setLoading(false)
      setError(null)
      return
    }

    // Check cache first
    const cached = cacheRef.current.get(url)
    if (cached) {
      setPreview(cached)
      setLoading(false)
      setError(null)
      return
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    // Debounce the fetch
    const timer = setTimeout(async () => {
      // Check if request was cancelled
      if (abortController.signal.aborted) return

      setLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/link-preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url }),
          signal: abortController.signal,
        })

        // Check if request was cancelled during fetch
        if (abortController.signal.aborted) return

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || "Failed to fetch preview")
        }

        const data: LinkPreview = await response.json()

        // Check if request was cancelled after fetch
        if (abortController.signal.aborted) return

        // Cache the result
        cacheRef.current.set(url, data)
        setPreview(data)
        setError(null)
      } catch (err: any) {
        // Don't set error for aborted requests
        if (err.name === "AbortError") return

        // Silently fail - just don't show preview
        setPreview(null)
        setError(err.message || "Failed to load preview")
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      }
    }, debounceMs)

    return () => {
      clearTimeout(timer)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [url, debounceMs, enabled])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return { preview, loading, error }
}




