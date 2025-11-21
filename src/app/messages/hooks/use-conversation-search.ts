"use client"

import { useEffect, useState, useRef } from "react"
import { toast } from "sonner"
import type { ConversationListItem } from "@/lib/chat-shared"

export function useConversationSearch(conversations: ConversationListItem[]) {
  const [searchTerm, setSearchTerm] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [displayedConversations, setDisplayedConversations] = useState<ConversationListItem[]>(conversations)
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!searchTerm.trim()) {
      setDisplayedConversations(conversations)
      return
    }
    // Debounced remote search
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(async () => {
      try {
        setSearchLoading(true)
        const params = new URLSearchParams()
        params.set("search", searchTerm.trim())
        params.set("limit", "30")
        const response = await fetch(`/api/dm/threads?${params.toString()}`, { cache: "no-store" })
        if (!response.ok) {
          throw new Error("Failed to search conversations")
        }
        const data = await response.json()
        setDisplayedConversations(data.conversations ?? [])
      } catch (error) {
        console.error(error)
        toast.error("Unable to search conversations right now.")
      } finally {
        setSearchLoading(false)
      }
    }, 350)

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
        searchDebounceRef.current = null
      }
    }
  }, [searchTerm])

  useEffect(() => {
    if (searchTerm.trim()) return
    setDisplayedConversations(conversations)
  }, [conversations, searchTerm])

  return {
    searchTerm,
    setSearchTerm,
    searchLoading,
    displayedConversations,
  }
}

