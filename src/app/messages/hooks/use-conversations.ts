"use client"

import { useCallback, useEffect, useRef, useState, startTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { ConversationListItem, MessageResult } from "@/lib/chat-shared"
import type { ThreadPaginationState } from "../types"

const DEFAULT_PAGE_SIZE = 50

interface UseConversationsOptions {
  initialConversations: ConversationListItem[]
  initialThreadId: string | null
  initialMessagesByThread: Record<string, MessageResult[]>
  initialPaginationByThread: ThreadPaginationState
  isMobile: boolean
  isClient: boolean
  ensureAttachmentUrls: (attachments: MessageResult["attachments"]) => Promise<void>
  messagesRef: React.MutableRefObject<Record<string, MessageResult[]>>
  conversationsRef: React.MutableRefObject<ConversationListItem[]>
  selectedThreadIdRef: React.MutableRefObject<string | null>
  mobileViewRef: React.MutableRefObject<"list" | "conversation">
  isMobileRef: React.MutableRefObject<boolean>
}

export function useConversations({
  initialConversations,
  initialThreadId,
  initialMessagesByThread,
  initialPaginationByThread,
  isMobile,
  isClient,
  ensureAttachmentUrls,
  messagesRef,
  conversationsRef,
  selectedThreadIdRef,
  mobileViewRef,
  isMobileRef,
}: UseConversationsOptions) {
  const [conversations, setConversations] = useState<ConversationListItem[]>(initialConversations)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(initialThreadId)
  const [messagesByThread, setMessagesByThread] = useState<Record<string, MessageResult[]>>(initialMessagesByThread)
  const [threadPagination, setThreadPagination] = useState<ThreadPaginationState>(initialPaginationByThread)
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<"list" | "conversation">("list")
  
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const abortControllerRef = useRef<AbortController | null>(null)
  const prefetchTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({})

  // Update refs
  useEffect(() => {
    messagesRef.current = messagesByThread
  }, [messagesByThread, messagesRef])

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations, conversationsRef])

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId
  }, [selectedThreadId, selectedThreadIdRef])

  useEffect(() => {
    mobileViewRef.current = mobileView
  }, [mobileView, mobileViewRef])

  useEffect(() => {
    isMobileRef.current = isMobile
  }, [isMobile, isMobileRef])

  // On mobile, always start with list view, even if there's an initial thread
  // Only run once when client becomes available and we're on mobile
  const hasInitializedMobileView = useRef(false)
  useEffect(() => {
    if (isMobile && isClient && !hasInitializedMobileView.current) {
      setMobileView("list")
      hasInitializedMobileView.current = true
    }
  }, [isMobile, isClient])

  const refreshConversations = useCallback(async () => {
    const response = await fetch("/api/dm/threads?limit=30", { cache: "no-store" })
    if (!response.ok) {
      throw new Error("Failed to refresh conversations")
    }

    const data = await response.json()
    const list: ConversationListItem[] = data.conversations ?? []
    setConversations(list)
    return list
  }, [])

  const prefetchMessages = useCallback(
    async (threadId: string) => {
      if (messagesRef.current[threadId]) {
        return
      }

      if (prefetchTimeoutRef.current[threadId]) {
        clearTimeout(prefetchTimeoutRef.current[threadId])
      }

      prefetchTimeoutRef.current[threadId] = setTimeout(() => {
        if (messagesRef.current[threadId]) {
          delete prefetchTimeoutRef.current[threadId]
          return
        }

        fetch(`/api/dm/threads/${threadId}/messages?limit=${DEFAULT_PAGE_SIZE}`, {
          cache: "no-store",
        })
          .then(async (response) => {
            if (!response.ok) {
              delete prefetchTimeoutRef.current[threadId]
              return
            }
            const data = await response.json()
            const fetchedMessages: MessageResult[] = data.messages ?? []
            
            if (messagesRef.current[threadId]) {
              delete prefetchTimeoutRef.current[threadId]
              return
            }
            
            setMessagesByThread((prev) => ({
              ...prev,
              [threadId]: fetchedMessages,
            }))
            setThreadPagination((prev) => ({
              ...prev,
              [threadId]: {
                hasMore: Boolean(data.pageInfo?.hasMore),
                nextCursor: data.pageInfo?.nextCursor ?? null,
              },
            }))
            
            ensureAttachmentUrls(fetchedMessages.flatMap((m) => m.attachments ?? [])).catch(() => {
              // Silent fail
            }).finally(() => {
              delete prefetchTimeoutRef.current[threadId]
            })
          })
          .catch(() => {
            delete prefetchTimeoutRef.current[threadId]
          })
      }, 150)
    },
    [ensureAttachmentUrls, messagesRef],
  )

  // Prefetch top conversations on load
  useEffect(() => {
    if (isMobile || !isClient) return
    
    const topConversations = conversations.slice(0, 3)
    topConversations.forEach((conversation, index) => {
      setTimeout(() => {
        if (!messagesRef.current[conversation.thread_id]) {
          prefetchMessages(conversation.thread_id)
        }
      }, index * 200)
    })
  }, [conversations, isMobile, isClient, prefetchMessages, messagesRef])

  const handleSelectConversation = useCallback(
    async (threadId: string) => {
      const normalizedThreadId = threadId.trim()
      
      if (prefetchTimeoutRef.current[normalizedThreadId]) {
        clearTimeout(prefetchTimeoutRef.current[normalizedThreadId])
        delete prefetchTimeoutRef.current[normalizedThreadId]
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      
      const abortController = new AbortController()
      abortControllerRef.current = abortController
      
      startTransition(() => {
        setSelectedThreadId(normalizedThreadId)
        if (isMobile) {
          setMobileView("conversation")
        }
      })

      if (messagesRef.current[normalizedThreadId]) {
        startTransition(() => {
          const currentThreadParam = searchParams?.get("thread")
          const hasPeerParam = !!searchParams?.get("peerId")
          if (currentThreadParam !== normalizedThreadId || hasPeerParam) {
            const nextParams = new URLSearchParams(searchParams?.toString() ?? "")
            nextParams.set("thread", normalizedThreadId)
            nextParams.delete("peerId")
            const queryString = nextParams.toString()
            router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
          }
        })
        setLoadingThreadId(null)
        return
      }

      setLoadingThreadId(normalizedThreadId)

      startTransition(() => {
        const currentThreadParam = searchParams?.get("thread")
        const hasPeerParam = !!searchParams?.get("peerId")
        if (currentThreadParam !== normalizedThreadId || hasPeerParam) {
          const nextParams = new URLSearchParams(searchParams?.toString() ?? "")
          nextParams.set("thread", normalizedThreadId)
          nextParams.delete("peerId")
          const queryString = nextParams.toString()
          router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
        }
      })

      try {
        const response = await fetch(`/api/dm/threads/${normalizedThreadId}/messages?limit=${DEFAULT_PAGE_SIZE}`, {
          cache: "no-store",
          signal: abortController.signal,
        })
        
        if (abortController.signal.aborted) {
          return
        }
        
        if (!response.ok) throw new Error("Failed to load messages")
        const data = await response.json()
        const fetchedMessages: MessageResult[] = data.messages ?? []
        
        if (abortController.signal.aborted) {
          return
        }
        
        startTransition(() => {
          setMessagesByThread((prev) => ({
            ...prev,
            [normalizedThreadId]: fetchedMessages,
          }))
          setThreadPagination((prev) => ({
            ...prev,
            [normalizedThreadId]: {
              hasMore: Boolean(data.pageInfo?.hasMore),
              nextCursor: data.pageInfo?.nextCursor ?? null,
            },
          }))
          setLoadingThreadId(null)
        })
        
        ensureAttachmentUrls(fetchedMessages.flatMap((m) => m.attachments ?? [])).catch((error) => {
          console.error("[handleSelectConversation] Error ensuring attachment URLs:", error)
        })
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }
        console.error("[handleSelectConversation] Error:", error)
        setLoadingThreadId(null)
      }
    },
    [isMobile, searchParams, router, pathname, messagesRef, ensureAttachmentUrls],
  )

  return {
    conversations,
    setConversations,
    selectedThreadId,
    setSelectedThreadId,
    messagesByThread,
    setMessagesByThread,
    threadPagination,
    setThreadPagination,
    loadingThreadId,
    mobileView,
    setMobileView,
    refreshConversations,
    prefetchMessages,
    handleSelectConversation,
  }
}

