"use client"

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react"
import Image from "next/image"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { RealtimeChannel } from "@supabase/supabase-js"
import {
  ArrowLeft,
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Mic,
  Pause,
  Play,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { supabase } from "@/lib/supabase"
import {
  DM_TYPING_EVENT,
  buildDmMediaStoragePath,
  getThreadChannelName,
  type ConversationListItem,
  type MessageResult,
} from "@/lib/chat-shared"
import type { DirectMessageParticipant, DirectMessageThread } from "@/types"
import { cn, formatRelativeTime, linkifyText } from "@/lib/utils"
import { VoiceNoteRecorder } from "@/components/voice-note-recorder"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useUnreadMessagesPerThread } from "@/hooks/use-unread-messages-per-thread"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

type ViewerProfile = {
  id: string
  username: string | null
  first_name: string | null
  last_name: string | null
  profile_picture: string | null
}

type AttachmentState = {
  id: string
  fileName: string
  mediaType: "image" | "audio" | "file"
  status: "uploading" | "ready" | "error"
  previewUrl?: string
  storagePath?: string
  objectPath?: string
  mimeType?: string
  fileSize?: number
  durationSeconds?: number
  error?: string
}

type ThreadPaginationState = Record<string, { hasMore: boolean; nextCursor: string | null }>

interface MessagesViewProps {
  viewer: ViewerProfile
  initialConversations: ConversationListItem[]
  initialThreadId: string | null
  initialMessagesByThread: Record<string, MessageResult[]>
  initialPaginationByThread: ThreadPaginationState
}

const DEFAULT_PAGE_SIZE = 50
const SIGNED_URL_TTL_SECONDS = 60 * 15 // 15 minutes
const SIGNED_URL_REFRESH_THRESHOLD = 60 * 10 // Refresh after 10 minutes
const MAX_ATTACHMENTS = 6
const TYPING_EXPIRATION_MS = 4000
const TYPING_DEBOUNCE_MS = 1200

function getDisplayName(profile: ViewerProfile | ConversationListItem["other_user_profile"]) {
  if (!profile) return "Unknown User"
  const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
  if (fullName.length > 0) return fullName
  if (profile.username) return `@${profile.username}`
  return "Unknown User"
}

function getInitials(
  profile: ViewerProfile | ConversationListItem["other_user_profile"],
) {
  if (!profile) return "?"
  const first = profile.first_name?.[0]
  const last = profile.last_name?.[0]
  if (first || last) {
    return `${first ?? ""}${last ?? ""}`.toUpperCase()
  }
  return profile.username?.slice(0, 2)?.toUpperCase() ?? "?"
}

function storagePathToObjectPath(storagePath: string | null | undefined) {
  if (!storagePath) return null
  const prefix = "dm-media/"
  if (storagePath.startsWith(prefix)) {
    return storagePath.slice(prefix.length)
  }
  return storagePath
}

function formatTimestamp(iso?: string | null) {
  if (!iso) return ""
  const date = new Date(iso)
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export default function MessagesView({
  viewer,
  initialConversations,
  initialThreadId,
  initialMessagesByThread,
  initialPaginationByThread,
}: MessagesViewProps) {
  const [conversations, setConversations] = useState<ConversationListItem[]>(initialConversations)
  const [displayedConversations, setDisplayedConversations] = useState<ConversationListItem[]>(initialConversations)
  const [searchTerm, setSearchTerm] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(initialThreadId)
  const [messagesByThread, setMessagesByThread] = useState<Record<string, MessageResult[]>>(initialMessagesByThread)
  const [threadPagination, setThreadPagination] = useState<ThreadPaginationState>(initialPaginationByThread)
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null)
  const [composerValue, setComposerValue] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentState[]>([])
  const [isVoiceRecorderOpen, setIsVoiceRecorderOpen] = useState(false)
  const [typingIndicators, setTypingIndicators] = useState<Record<string, { userId: string; expiresAt: number }>>({})
  const [displayTypingIndicators, setDisplayTypingIndicators] = useState<Record<string, boolean>>({})
  const [presenceMap, setPresenceMap] = useState<Record<string, boolean>>({})
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, { url: string; expiresAt: number }>>({})
  const [isMobile, setIsMobile] = useState(false)
  const [mobileView, setMobileView] = useState<"list" | "conversation">("list")
  const [isClient, setIsClient] = useState(false)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)
  const [audioProgress, setAudioProgress] = useState<Record<string, { current: number; duration: number }>>({})
  const [longPressMenuOpen, setLongPressMenuOpen] = useState<string | null>(null)
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Get unread message counts per thread
  const threadIds = conversations.map((c) => c.thread_id)
  const { unreadCounts } = useUnreadMessagesPerThread(viewer.id, threadIds)

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const messageContainerRef = useRef<HTMLDivElement | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const typingBroadcastCooldownRef = useRef<NodeJS.Timeout | null>(null)
  const typingDisplayTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({})
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const attachmentsRef = useRef<AttachmentState[]>(attachments)
  const messagesRef = useRef(messagesByThread)
  const conversationsRef = useRef(conversations)
  const lastThreadFromQueryRef = useRef<string | null>(null)

  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl)
        }
      })
      // Cleanup audio elements
      Object.values(audioRefs.current).forEach(audio => {
        audio.pause()
        audio.src = ''
      })
    }
  }, [])

  useEffect(() => {
    messagesRef.current = messagesByThread
  }, [messagesByThread])

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.thread_id === selectedThreadId) ?? null,
    [conversations, selectedThreadId],
  )

  const selectedMessages = selectedThreadId ? messagesByThread[selectedThreadId] ?? [] : []

  useEffect(() => {
    setIsClient(true)
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

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

  useEffect(() => {
    if (!selectedThreadId) return
    const container = messageContainerRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: "auto" })
  }, [selectedThreadId])

  useEffect(() => {
    if (!selectedThreadId) return
    const container = messageContainerRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })
  }, [selectedMessages.length, selectedThreadId])

  const ensureAttachmentUrls = useCallback(
    async (attachmentsToEnsure: MessageResult["attachments"], forceRefresh = false) => {
      if (!attachmentsToEnsure || attachmentsToEnsure.length === 0) return

      const now = Date.now()

      await Promise.all(
        attachmentsToEnsure.map(async (attachment) => {
          const existing = attachmentUrls[attachment.id]
          
          // Skip if URL exists and hasn't expired (unless force refresh)
          if (!forceRefresh && existing && existing.expiresAt > now + SIGNED_URL_REFRESH_THRESHOLD * 1000) {
            return
          }

          const objectPath = storagePathToObjectPath(attachment.storage_path)
          if (!objectPath) {
            // Silently skip if no valid object path
            return
          }

          try {
            const { data, error } = await supabase.storage
              .from("dm-media")
              .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS)

            // Silently skip if any error occurs (file not found, permissions, etc.)
            if (error || !data?.signedUrl) {
              return
            }

            setAttachmentUrls((prev) => ({
              ...prev,
              [attachment.id]: {
                url: data.signedUrl,
                expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000,
              },
            }))
          } catch (error) {
            // Silently catch and ignore all exceptions to prevent console spam
            return
          }
        }),
      )
    },
    [attachmentUrls],
  )

  useEffect(() => {
    if (!selectedMessages.length) return
    ensureAttachmentUrls(selectedMessages.flatMap((message) => message.attachments ?? []))
  }, [selectedMessages, ensureAttachmentUrls])

  // Preload audio metadata to get duration immediately
  useEffect(() => {
    if (!selectedMessages.length) return
    
    const audioAttachments = selectedMessages.flatMap(m =>
      (m.attachments ?? []).filter(a => a.media_type === 'audio')
    )

    audioAttachments.forEach((attachment) => {
      const signedUrl = attachmentUrls[attachment.id]?.url
      if (!signedUrl || audioRefs.current[attachment.id]) return

      const audio = new Audio(signedUrl)
      
      audio.addEventListener('loadedmetadata', () => {
        setAudioProgress(prev => ({
          ...prev,
          [attachment.id]: {
            current: 0,
            duration: audio.duration || 0
          }
        }))
      })
      
      audio.addEventListener('timeupdate', () => {
        setAudioProgress(prev => ({
          ...prev,
          [attachment.id]: {
            current: audio.currentTime,
            duration: audio.duration || 0
          }
        }))
      })
      
      audio.addEventListener('ended', () => {
        setPlayingAudio(null)
        setAudioProgress(prev => ({
          ...prev,
          [attachment.id]: {
            current: 0,
            duration: prev[attachment.id]?.duration || 0
          }
        }))
      })
      
      audio.addEventListener('pause', () => {
        if (audio.ended) {
          setPlayingAudio(null)
        }
      })
      
      audioRefs.current[attachment.id] = audio
      audio.load()
    })
  }, [selectedMessages, attachmentUrls])

  useEffect(() => {
    if (selectedThreadId) return

    const fallback =
      selectedConversation?.thread_id ??
      conversationsRef.current[0]?.thread_id ??
      displayedConversations[0]?.thread_id ??
      initialThreadId ??
      null

    if (fallback) {
      setSelectedThreadId(fallback)
    }
  }, [selectedThreadId, selectedConversation, displayedConversations, initialThreadId])

  // Set mobile view to conversation when initialThreadId is provided (e.g., from query parameter)
  useEffect(() => {
    if (initialThreadId && isMobile && isClient) {
      setMobileView("conversation")
    }
  }, [initialThreadId, isMobile, isClient])

  const refreshConversations = useCallback(async () => {
    const response = await fetch("/api/dm/threads?limit=30", { cache: "no-store" })
    if (!response.ok) {
      throw new Error("Failed to refresh conversations")
    }

    const data = await response.json()
    const list: ConversationListItem[] = data.conversations ?? []
    setConversations(list)
    if (!searchTerm.trim()) {
      setDisplayedConversations(list)
    }
    return list
  }, [searchTerm])

  // Prefetch messages for conversations on hover (desktop only) for instant switching
  // Use a ref to track prefetch timeouts to debounce rapid hovers
  const prefetchTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({})
  
  const prefetchMessages = useCallback(
    async (threadId: string) => {
      // Only prefetch if messages aren't already loaded
      if (messagesRef.current[threadId]) {
        return
      }

      // Clear any existing timeout for this thread
      if (prefetchTimeoutRef.current[threadId]) {
        clearTimeout(prefetchTimeoutRef.current[threadId])
      }

      // Debounce prefetch - wait 150ms after hover to avoid prefetching on quick mouse moves
      prefetchTimeoutRef.current[threadId] = setTimeout(() => {
        // Double-check messages aren't loaded (might have been loaded by click)
        if (messagesRef.current[threadId]) {
          delete prefetchTimeoutRef.current[threadId]
          return
        }

        // Prefetch in background - don't await
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
            
            // Double-check we still need to cache (might have been loaded by click)
            if (messagesRef.current[threadId]) {
              delete prefetchTimeoutRef.current[threadId]
              return
            }
            
            // Cache messages silently
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
            
            // Prefetch attachment URLs in background (non-blocking)
            ensureAttachmentUrls(fetchedMessages.flatMap((m) => m.attachments ?? [])).catch(() => {
              // Silent fail - non-critical
            }).finally(() => {
              delete prefetchTimeoutRef.current[threadId]
            })
          })
          .catch(() => {
            // Silent fail - prefetch is optional
            delete prefetchTimeoutRef.current[threadId]
          })
      }, 150) // 150ms debounce
    },
    [ensureAttachmentUrls],
  )

  // Prefetch messages for top conversations on load (desktop only) for faster switching
  useEffect(() => {
    if (isMobile || !isClient) return
    
    // Prefetch top 3 conversations (most likely to be opened)
    const topConversations = conversations.slice(0, 3)
    topConversations.forEach((conversation, index) => {
      // Stagger prefetch slightly to avoid overwhelming the server
      setTimeout(() => {
        if (!messagesRef.current[conversation.thread_id]) {
          prefetchMessages(conversation.thread_id)
        }
      }, index * 200) // 200ms delay between each prefetch
    })
  }, [conversations, isMobile, isClient, prefetchMessages])

  const handleSelectConversation = useCallback(
    async (threadId: string) => {
      const normalizedThreadId = threadId.trim()
      
      // Cancel any pending prefetch for this thread
      if (prefetchTimeoutRef.current[normalizedThreadId]) {
        clearTimeout(prefetchTimeoutRef.current[normalizedThreadId])
        delete prefetchTimeoutRef.current[normalizedThreadId]
      }

      // Cancel any in-flight fetch requests for previous conversation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      
      // Create new AbortController for this request
      const abortController = new AbortController()
      abortControllerRef.current = abortController
      
      // Immediately update UI state for instant feedback (SPA-like)
      // Use startTransition to make state updates non-blocking
      startTransition(() => {
        setSelectedThreadId(normalizedThreadId)
        if (isMobile) {
          setMobileView("conversation")
        }
      })

      // If messages are already cached, update URL and we're done - instant switch!
      if (messagesRef.current[normalizedThreadId]) {
        // Update URL asynchronously (non-blocking)
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

      // Set loading state immediately so UI can show loading indicator
      setLoadingThreadId(normalizedThreadId)

      // Update URL asynchronously (non-blocking) - use startTransition
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

      // Fetch messages in background - don't block UI
      try {
        const response = await fetch(`/api/dm/threads/${normalizedThreadId}/messages?limit=${DEFAULT_PAGE_SIZE}`, {
          cache: "no-store",
          signal: abortController.signal, // Allow cancellation if user switches quickly
        })
        
        // Check if request was aborted
        if (abortController.signal.aborted) {
          return
        }
        
        if (!response.ok) throw new Error("Failed to load messages")
        const data = await response.json()
        const fetchedMessages: MessageResult[] = data.messages ?? []
        
        // Check again if request was aborted before updating state
        if (abortController.signal.aborted) {
          return
        }
        
        // Update messages state using startTransition for non-blocking update
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
        
        // Ensure attachment URLs in background - don't block
        ensureAttachmentUrls(fetchedMessages.flatMap((m) => m.attachments ?? [])).catch((error) => {
          console.error("Error ensuring attachment URLs:", error)
          // Non-critical error - don't show toast
        })
      } catch (error: any) {
        // Ignore abort errors
        if (error.name === 'AbortError') {
          return
        }
        console.error(error)
        if (!abortController.signal.aborted) {
          setLoadingThreadId(null)
          toast.error("We couldn't load that conversation right now.")
        }
      }
    },
    [ensureAttachmentUrls, isMobile, pathname, router, searchParams],
  )

  const handleMarkThreadRead = useCallback(
    async (threadId: string) => {
      try {
        await fetch(`/api/dm/threads/${threadId}/read`, { method: "POST" })
        setConversations((prev) =>
          prev.map((item) =>
            item.thread_id === threadId
              ? {
                  ...item,
                  last_read_at: new Date().toISOString(),
                }
              : item,
          ),
        )
      } catch (error) {
        console.error(error)
      }
    },
    [],
  )

  useEffect(() => {
    const params = searchParams
    if (!params) return

    const peerParam = params.get("peerId")
    if (peerParam) {
      return
    }

    const threadParam = params.get("thread")?.trim()
    if (!threadParam || threadParam === selectedThreadId || lastThreadFromQueryRef.current === threadParam) {
      return
    }

    let cancelled = false

    const selectFromQuery = async () => {
      try {
        let conversation = conversationsRef.current.find((item) => item.thread_id === threadParam)
        if (!conversation) {
          try {
            const refreshed = await refreshConversations()
            if (cancelled) return
            conversation = refreshed.find((item) => item.thread_id === threadParam)
          } catch (error) {
            console.error(error)
          }
        }

        if (cancelled) return

        if (conversation) {
          // Set mobile view to conversation when opening from query parameter
          if (typeof window !== "undefined" && window.innerWidth < 1024) {
            setMobileView("conversation")
          }
          await handleSelectConversation(threadParam)
          if (!cancelled) {
            lastThreadFromQueryRef.current = threadParam
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error)
        }
      }
    }

    selectFromQuery()

    return () => {
      cancelled = true
    }
  }, [handleSelectConversation, refreshConversations, searchParams, selectedThreadId])

  useEffect(() => {
    const params = searchParams
    if (!params) return

    const peerParam = params.get("peerId")?.trim()
    if (!peerParam) return

    let cancelled = false

    const openFromPeer = async () => {
      try {
        const response = await fetch("/api/dm/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peerUserId: peerParam }),
        })

        if (!response.ok) {
          throw new Error("Failed to open conversation")
        }

        const data = await response.json()
        const threadId: string | undefined = data?.thread?.id ?? data?.threadId
        if (!threadId) {
          throw new Error("Conversation unavailable")
        }

        if (!conversationsRef.current.some((item) => item.thread_id === threadId)) {
          try {
            await refreshConversations()
            if (cancelled) return
          } catch (error) {
            console.error(error)
          }
        }

        if (cancelled) return

        const nextParams = new URLSearchParams(params.toString())
        nextParams.set("thread", threadId)
        nextParams.delete("peerId")
        const queryString = nextParams.toString()
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })

        // Set mobile view to conversation when opening from peerId
        if (typeof window !== "undefined" && window.innerWidth < 1024) {
          setMobileView("conversation")
        }
        await handleSelectConversation(threadId)
        if (!cancelled) {
          lastThreadFromQueryRef.current = threadId
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error)
          toast.error("Unable to open conversation right now.")
        }
      }
    }

    openFromPeer()

    return () => {
      cancelled = true
    }
  }, [handleSelectConversation, pathname, refreshConversations, router, searchParams])

  useEffect(() => {
    if (!selectedConversation || !selectedThreadId) return
    const lastMessageAt = selectedConversation.last_message_at
    const lastReadAt = selectedConversation.last_read_at
    const unread =
      lastMessageAt && (!lastReadAt || new Date(lastMessageAt).getTime() > new Date(lastReadAt).getTime())

    if (unread) {
      handleMarkThreadRead(selectedThreadId)
    }
  }, [selectedConversation, selectedThreadId, handleMarkThreadRead])

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current)
      } catch (error) {
        console.error("[cleanupChannel] Error removing channel:", error)
      } finally {
        channelRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    cleanupChannel()
    if (!selectedThreadId || !selectedConversation) return

    const channel = supabase
      .channel(getThreadChannelName(selectedThreadId), {
        config: {
          presence: {
            key: viewer.id,
          },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_messages",
          filter: `thread_id=eq.${selectedThreadId}`,
        },
        async (payload) => {
          const newMessage = payload.new as MessageResult
          if (!newMessage) return

          // Skip if this is our own message - it's already added optimistically
          if (newMessage.sender_id === viewer.id) {
            return
          }

          const existingMessages = messagesRef.current[selectedThreadId] ?? []
          if (existingMessages.some((message) => message.id === newMessage.id)) {
            return
          }

          const { data: attachmentsData } = await supabase
            .from("dm_message_media")
            .select("id, message_id, media_type, storage_path, mime_type, file_size, duration_seconds, created_at")
            .eq("message_id", newMessage.id)

          const enrichedMessage: MessageResult = {
            ...newMessage,
            attachments: attachmentsData ?? [],
          }

          setMessagesByThread((prev) => ({
            ...prev,
            [selectedThreadId]: [...(prev[selectedThreadId] ?? []), enrichedMessage],
          }))

          setConversations((prev) =>
            prev
              .map((item) =>
                item.thread_id === selectedThreadId
                  ? {
                      ...item,
                      last_message_at: enrichedMessage.created_at,
                      last_message_preview: enrichedMessage.content ?? (enrichedMessage.attachments?.length ? "[attachment]" : ""),
                      last_message_sender_id: enrichedMessage.sender_id,
                      updated_at: new Date().toISOString(),
                    }
                  : item,
              )
              .sort((a, b) => {
                const aTime = new Date(a.last_message_at ?? a.updated_at).getTime()
                const bTime = new Date(b.last_message_at ?? b.updated_at).getTime()
                return bTime - aTime
              }),
          )

          ensureAttachmentUrls(enrichedMessage.attachments ?? [])
        },
      )
      .on(
        "presence",
        { event: "sync" },
        () => {
          const state = channel.presenceState<{ userId: string }>()
          const otherUserId = selectedConversation.other_user_id
          const otherIsPresent = Object.values(state).some((entries) =>
            entries.some((item) => item.userId === otherUserId),
          )
          setPresenceMap((prev) => ({
            ...prev,
            [selectedThreadId]: otherIsPresent,
          }))
        },
      )
      .on("broadcast", { event: DM_TYPING_EVENT }, ({ payload }) => {
        if (!payload) return
        const { userId, typing } = payload as { userId: string; typing: boolean }
        if (!userId || userId === viewer.id) return
        setTypingIndicators((prev) => {
          const expiresAt = Date.now() + TYPING_EXPIRATION_MS
          const next = { ...prev }
          if (typing) {
            next[selectedThreadId] = { userId, expiresAt }
          } else {
            delete next[selectedThreadId]
          }
          return next
        })
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          try {
            await channel.track({ userId: viewer.id, at: Date.now() })
          } catch (error) {
            console.error("[channel.subscribe] Failed to track presence:", error)
          }
        } else if (status === "CHANNEL_ERROR") {
          console.error("[channel.subscribe] Channel error detected, will attempt reconnect")
        } else if (status === "TIMED_OUT") {
          console.error("[channel.subscribe] Channel timed out")
        }
      })

    channelRef.current = channel

    return () => {
      cleanupChannel()
    }
  }, [cleanupChannel, ensureAttachmentUrls, selectedConversation, selectedThreadId, viewer.id])

  useEffect(() => {
    if (!selectedThreadId) return
    if (!typingIndicators[selectedThreadId]) return

    const timeout = setTimeout(() => {
      setTypingIndicators((prev) => {
        const current = prev[selectedThreadId]
        if (!current) return prev
        if (Date.now() < current.expiresAt) return prev
        const next = { ...prev }
        delete next[selectedThreadId]
        return next
      })
    }, TYPING_EXPIRATION_MS)

    return () => clearTimeout(timeout)
  }, [selectedThreadId, typingIndicators])

  // Add grace period for typing indicator display (prevents flicker on brief pauses)
  useEffect(() => {
    if (!selectedThreadId) return

    const isTyping = !!typingIndicators[selectedThreadId]

    if (isTyping) {
      // Show immediately when typing starts
      setDisplayTypingIndicators((prev) => ({
        ...prev,
        [selectedThreadId]: true,
      }))
      
      // Clear any pending hide timeout
      if (typingDisplayTimeoutRef.current[selectedThreadId]) {
        clearTimeout(typingDisplayTimeoutRef.current[selectedThreadId])
        delete typingDisplayTimeoutRef.current[selectedThreadId]
      }
    } else {
      // Keep showing for 2 more seconds after typing stops (grace period)
      const timeout = setTimeout(() => {
        setDisplayTypingIndicators((prev) => {
          const next = { ...prev }
          delete next[selectedThreadId]
          return next
        })
        delete typingDisplayTimeoutRef.current[selectedThreadId]
      }, 2000)
      
      typingDisplayTimeoutRef.current[selectedThreadId] = timeout
    }

    return () => {
      if (typingDisplayTimeoutRef.current[selectedThreadId]) {
        clearTimeout(typingDisplayTimeoutRef.current[selectedThreadId])
        delete typingDisplayTimeoutRef.current[selectedThreadId]
      }
    }
  }, [selectedThreadId, typingIndicators])

  const notifyTyping = useCallback(
    (typing: boolean) => {
      if (!channelRef.current) return
      channelRef.current.send({
        type: "broadcast",
        event: DM_TYPING_EVENT,
        payload: {
          userId: viewer.id,
          typing,
        },
      })
    },
    [viewer.id],
  )

  const scheduleTypingBroadcast = useCallback(() => {
    if (typingBroadcastCooldownRef.current) return
    notifyTyping(true)
    typingBroadcastCooldownRef.current = setTimeout(() => {
      typingBroadcastCooldownRef.current = null
      notifyTyping(false)
    }, TYPING_EXPIRATION_MS)
  }, [notifyTyping])

  // Auto-resize textarea based on content
  const autoResizeTextarea = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto"
    // Set height to scrollHeight, but respect max-height
    const scrollHeight = textarea.scrollHeight
    // Calculate max-height based on breakpoint (sm is 640px)
    const isSmallScreen = typeof window !== "undefined" && window.innerWidth < 640
    const maxHeight = isSmallScreen ? 96 : 128 // max-h-24 (96px) or sm:max-h-32 (128px)
    // Min height should account for padding (4px top + 4px bottom = 8px) plus text height
    const minHeight = 32 // Adjusted to better align with buttons
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
    textarea.style.height = `${newHeight}px`
  }, [])

  const resetComposer = useCallback(() => {
      setComposerValue("")
      setAttachments((prev) => {
        prev.forEach((attachment) => {
          if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
        })
        return []
      })
      // Reset textarea height after clearing
      setTimeout(() => {
        autoResizeTextarea()
      }, 0)
  }, [autoResizeTextarea])

  // Auto-resize textarea on mount and when composer value changes
  useEffect(() => {
    autoResizeTextarea()
  }, [composerValue, autoResizeTextarea])

  const handleComposerChange = useCallback(
    (value: string) => {
      setComposerValue(value)
      scheduleTypingBroadcast()
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        notifyTyping(false)
      }, TYPING_DEBOUNCE_MS)
      
      // Auto-resize textarea after state update
      setTimeout(() => {
        autoResizeTextarea()
      }, 0)
    },
    [notifyTyping, scheduleTypingBroadcast, autoResizeTextarea],
  )

  const handleAddFiles = useCallback(
    async (files: File[] | null, mediaType: AttachmentState["mediaType"]) => {
      if (!files || files.length === 0) return
      const remainingSlots = MAX_ATTACHMENTS - attachmentsRef.current.length
      if (remainingSlots <= 0) {
        toast.error(`You can attach up to ${MAX_ATTACHMENTS} files per message.`)
        return
      }

      const selected = files.slice(0, remainingSlots)

      for (const file of selected) {
        const id = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
        const previewUrl = mediaType === "image" ? URL.createObjectURL(file) : undefined

        const pendingAttachment: AttachmentState = {
          id,
          fileName: file.name,
          mediaType,
          previewUrl,
          status: "uploading",
        }

        setAttachments((prev) => [...prev, pendingAttachment])

        try {
          const extension = file.name?.split(".").pop() ?? "bin"
          const { bucket, objectPath, storagePath } = buildDmMediaStoragePath(viewer.id, extension)
          const { error } = await supabase.storage.from(bucket).upload(objectPath, file, {
            cacheControl: "0",
            upsert: false,
            contentType: file.type || "application/octet-stream",
          })

          if (error) {
            throw error
          }

          setAttachments((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    status: "ready",
                    storagePath,
                    objectPath,
                    mimeType: file.type,
                    fileSize: file.size,
                  }
                : item,
            ),
          )
        } catch (error: any) {
          console.error(error)
          toast.error(`Failed to upload ${file.name}`)
          setAttachments((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    status: "error",
                    error: error?.message ?? "Upload failed",
                  }
                : item,
            ),
          )
        }
      }
    },
    [viewer.id],
  )

  const handleVoiceNoteComplete = useCallback(async (blob: Blob) => {
    const fileName = `voice-note-${Date.now()}.webm`
    const file = new File([blob], fileName, { type: "audio/webm" })
    await handleAddFiles([file], "audio")
    setIsVoiceRecorderOpen(false)
  }, [handleAddFiles])

  const handleVoiceNoteCancel = useCallback(() => {
    setIsVoiceRecorderOpen(false)
  }, [])

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const next = prev.filter((item) => item.id !== id)
      const removed = prev.find((item) => item.id === id)
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl)
      }
      return next
    })
  }, [])

  const handleSendMessage = useCallback(async () => {
    let normalizedThreadId = selectedThreadId?.trim() ?? ""
    if (!normalizedThreadId) {
      const fallbackThreadId =
        conversationsRef.current[0]?.thread_id?.trim() ??
        displayedConversations[0]?.thread_id?.trim() ??
        initialThreadId?.trim() ??
        ""

      if (!fallbackThreadId) {
        try {
          const refreshed = await refreshConversations()
          normalizedThreadId = refreshed[0]?.thread_id?.trim() ?? ""
        } catch (error) {
          console.error(error)
        }
      } else {
        normalizedThreadId = fallbackThreadId
      }

      if (normalizedThreadId) {
        await handleSelectConversation(normalizedThreadId)
      } else {
        toast.error("Select a conversation before sending a message.")
        return
      }
    }
    if (isSending) return
    const trimmed = composerValue.trim()
    const readyAttachments = attachments.filter((attachment) => attachment.status === "ready")

    if (!trimmed && readyAttachments.length === 0) {
      toast.info("Type a message or add an attachment to send.")
      return
    }

    try {
      setIsSending(true)
      const response = await fetch(`/api/dm/threads/${normalizedThreadId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: trimmed.length > 0 ? trimmed : null,
          attachments: readyAttachments.map((attachment) => ({
            storagePath: attachment.storagePath,
            mediaType: attachment.mediaType,
            mimeType: attachment.mimeType,
            fileSize: attachment.fileSize,
            durationSeconds: attachment.durationSeconds,
          })),
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : "Failed to send message"
        throw new Error(message)
      }

      const data = payload
      const sentMessage: MessageResult | undefined = data?.message
      if (sentMessage) {
        const withAttachments: MessageResult = {
          ...sentMessage,
          attachments: sentMessage.attachments ?? [],
        }

        setMessagesByThread((prev) => ({
          ...prev,
          [normalizedThreadId]: [...(prev[normalizedThreadId] ?? []), withAttachments],
        }))
        setConversations((prev) =>
          prev
            .map((item) =>
              item.thread_id === normalizedThreadId
                ? {
                    ...item,
                    last_message_at: withAttachments.created_at,
                    last_message_preview: withAttachments.content ?? (withAttachments.attachments?.length ? "[attachment]" : ""),
                    last_message_sender_id: viewer.id,
                    updated_at: new Date().toISOString(),
                  }
                : item,
            )
            .sort((a, b) => {
              const aTime = new Date(a.last_message_at ?? a.updated_at).getTime()
              const bTime = new Date(b.last_message_at ?? b.updated_at).getTime()
              return bTime - aTime
            }),
        )

        ensureAttachmentUrls(withAttachments.attachments ?? [])
        resetComposer()
      }
    } catch (error) {
      console.error(error)
      const fallback = "Could not send your message. Please try again."
      const message = error instanceof Error ? error.message || fallback : fallback
      toast.error(message)
    } finally {
      setIsSending(false)
      notifyTyping(false)
      // Clear the typing display timeout immediately when message is sent
      if (selectedThreadId && typingDisplayTimeoutRef.current[selectedThreadId]) {
        clearTimeout(typingDisplayTimeoutRef.current[selectedThreadId])
        delete typingDisplayTimeoutRef.current[selectedThreadId]
      }
    }
  }, [
    attachments,
    displayedConversations,
    composerValue,
    ensureAttachmentUrls,
    isSending,
    refreshConversations,
    handleSelectConversation,
    notifyTyping,
    resetComposer,
    selectedThreadId,
    initialThreadId,
    viewer.id,
  ])

  const handleLongPressStart = useCallback((messageId: string, e: React.TouchEvent) => {
    if (!isMobile) return
    
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
    
    longPressTimer.current = setTimeout(() => {
      setLongPressMenuOpen(messageId)
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    }, 500) // 500ms for long press
  }, [isMobile])

  const handleLongPressMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current || !longPressTimer.current) return
    
    const deltaX = Math.abs(e.touches[0].clientX - touchStart.current.x)
    const deltaY = Math.abs(e.touches[0].clientY - touchStart.current.y)
    
    // Cancel if moved more than 10px (user is scrolling)
    if (deltaX > 10 || deltaY > 10) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
      touchStart.current = null
    }
  }, [])

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    touchStart.current = null
  }, [])

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!selectedThreadId) return
    if (deletingMessageId) return

    try {
      setDeletingMessageId(messageId)
      const response = await fetch(`/api/dm/threads/${selectedThreadId}/messages/${messageId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete message")
      }

      // Remove message from local state
      setMessagesByThread((prev) => ({
        ...prev,
        [selectedThreadId]: (prev[selectedThreadId] ?? []).filter((m) => m.id !== messageId),
      }))

      toast.success("Message deleted")
    } catch (error) {
      console.error(error)
      toast.error("Failed to delete message")
    } finally {
      setDeletingMessageId(null)
    }
  }, [selectedThreadId, deletingMessageId])

  const formatAudioTime = useCallback((seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  const handleAudioPlay = useCallback((audioId: string) => {
    // Stop any OTHER currently playing audio
    Object.keys(audioRefs.current).forEach(key => {
      if (key !== audioId) {
        const audio = audioRefs.current[key]
        if (audio && !audio.paused) {
          audio.pause()
          audio.currentTime = 0
        }
      }
    })

    const audio = audioRefs.current[audioId]
    if (!audio) return
    
    if (playingAudio === audioId) {
      audio.pause()
      setPlayingAudio(null)
    } else {
      audio.play()
      setPlayingAudio(audioId)
    }
  }, [playingAudio])

  const handleLoadOlderMessages = useCallback(async () => {
    const normalizedThreadId = selectedThreadId?.trim()
    if (!normalizedThreadId) return
    const pagination = threadPagination[normalizedThreadId]
    if (!pagination?.hasMore || loadingOlderMessages) return

    try {
      setLoadingOlderMessages(true)
      const params = new URLSearchParams()
      params.set("limit", String(DEFAULT_PAGE_SIZE))
      if (pagination.nextCursor) {
        params.set("before", pagination.nextCursor)
      }

      const response = await fetch(`/api/dm/threads/${normalizedThreadId}/messages?${params.toString()}`, {
        cache: "no-store",
      })
      if (!response.ok) {
        throw new Error("Failed to load older messages")
      }
      const data = await response.json()
      const fetchedMessages: MessageResult[] = data.messages ?? []
      setMessagesByThread((prev) => ({
        ...prev,
        [normalizedThreadId]: [...fetchedMessages, ...(prev[normalizedThreadId] ?? [])],
      }))
      setThreadPagination((prev) => ({
        ...prev,
        [normalizedThreadId]: {
          hasMore: Boolean(data.pageInfo?.hasMore),
          nextCursor: data.pageInfo?.nextCursor ?? null,
        },
      }))
      ensureAttachmentUrls(fetchedMessages.flatMap((m) => m.attachments ?? []))
    } catch (error) {
      console.error(error)
      toast.error("Unable to load more messages.")
    } finally {
      setLoadingOlderMessages(false)
    }
  }, [ensureAttachmentUrls, loadingOlderMessages, selectedThreadId, threadPagination])

  const typingActive = selectedThreadId ? displayTypingIndicators[selectedThreadId] : false
  const peerProfile = selectedConversation?.other_user_profile ?? null
  const peerName = getDisplayName(peerProfile)
  const peerInitials = getInitials(peerProfile)
  const peerAvatar = peerProfile?.profile_picture ?? null
  const isPeerOnline = selectedThreadId ? presenceMap[selectedThreadId] ?? false : false
  // Only disable composer if participant is blocked
  const composerDisabled = selectedConversation?.participant_status === "blocked"

  const conversationsToRender = displayedConversations

  const handleBackToList = useCallback(() => {
    setMobileView("list")
  }, [])

  return (
    <div className="flex flex-col h-[calc(100dvh-5rem-3rem)] lg:h-[calc(100dvh-5rem)] w-full">
      <div className="flex flex-col lg:flex-row gap-4 h-full overflow-hidden">
        <div className={cn(
          "w-full lg:w-[360px] xl:w-[400px] lg:flex-none flex flex-col h-full",
          !isClient && "lg:flex hidden",
          isClient && isMobile && mobileView === "conversation" && "hidden"
        )}>
          <div className="bg-white/10 border border-white/20 rounded-2xl backdrop-blur-md shadow-[0_20px_60px_-15px_rgba(0,0,0,0.45)] flex flex-col h-full">
            <div className="p-4 border-b border-white/15">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search conversations"
                  className="bg-white/10 border-white/15 text-white pl-9 placeholder:text-white/40"
                />
                {searchLoading && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/60" />
                )}
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {conversationsToRender.length === 0 && (
                  <div className="px-3 py-8 text-center text-white/50 text-sm">
                    No conversations found yet. Follow someone and start a chat!
                  </div>
                )}
                {conversationsToRender.map((conversation) => {
                  const otherProfile = conversation.other_user_profile
                  const displayName = getDisplayName(otherProfile)
                  const initials = getInitials(otherProfile)
                  const avatarImage = otherProfile?.profile_picture ?? undefined
                  // Only show selected state on desktop - on mobile, the list is hidden when viewing a conversation
                  const selected = !isMobile && conversation.thread_id === selectedThreadId
                  const lastMessagePreview = conversation.last_message_preview || (conversation.last_message_sender_id ? "[attachment]" : "No messages yet")
                  const unread =
                    conversation.last_message_sender_id &&
                    conversation.last_message_sender_id !== viewer.id &&
                    conversation.last_message_at &&
                    (!conversation.last_read_at ||
                      new Date(conversation.last_message_at).getTime() > new Date(conversation.last_read_at).getTime())

                  const typingForConversation =
                    typingIndicators[conversation.thread_id] && typingIndicators[conversation.thread_id]?.userId === conversation.other_user_id

                  return (
                    <button
                      key={conversation.thread_id}
                      type="button"
                      onClick={() => handleSelectConversation(conversation.thread_id)}
                      onMouseEnter={() => {
                        // Prefetch messages on hover for instant switching (desktop only)
                        if (!isMobile) {
                          prefetchMessages(conversation.thread_id)
                        }
                      }}
                      className={cn(
                        "w-full rounded-xl border transition-all text-left backdrop-blur-md cursor-pointer",
                        "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20",
                        selected && "bg-white/10 border-white/20 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]",
                      )}
                    >
                      <div className="px-3 py-3 flex items-start gap-3">
                        <Avatar className="h-11 w-11 border-4 border-white/20" userId={otherProfile?.id} isOnline={presenceMap[conversation.thread_id] || false}>
                          <AvatarImage src={avatarImage} alt={displayName} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground uppercase">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white/80 font-medium truncate">{displayName}</p>
                            {typingForConversation && (
                              <Badge className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-100">Typing</Badge>
                            )}
                          </div>
                          <p className={cn("text-xs truncate", unread ? "text-white" : "text-white/50")}>
                            {typingForConversation ? "Typing…" : lastMessagePreview}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-[11px] text-white/50" suppressHydrationWarning>
                            {conversation.last_message_at
                              ? formatRelativeTime(conversation.last_message_at)
                              : formatRelativeTime(conversation.updated_at)}
                          </span>
                          {(() => {
                            const unreadCount = unreadCounts[conversation.thread_id] || 0
                            if (unreadCount > 0) {
                              return (
                                <Badge className="h-5 min-w-5 px-1.5 flex items-center justify-center bg-white/90 text-black border-0 text-[10px] font-semibold shadow-md">
                                  {unreadCount > 99 ? "99+" : unreadCount}
                                </Badge>
                              )
                            }
                            return null
                          })()}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className={cn(
          "flex flex-col h-full overflow-hidden lg:flex-1",
          !isClient && "hidden lg:flex",
          isClient && isMobile && mobileView === "list" && "hidden lg:flex",
          isClient && isMobile && mobileView === "conversation" && "flex"
        )}>
          <div className="bg-white/10 border border-white/20 rounded-2xl backdrop-blur-md shadow-[0_20px_60px_-15px_rgba(0,0,0,0.45)] flex flex-col h-full">
            {selectedConversation ? (
              <>
                <div className="p-4 border-b border-white/15 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {isMobile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleBackToList}
                        className="rounded-full text-white/70 hover:text-white/90 hover:bg-white/10 shrink-0"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </Button>
                    )}
                    <Avatar className="h-11 w-11 border-4 border-white/20" userId={peerProfile?.id} isOnline={isPeerOnline}>
                      <AvatarImage src={peerAvatar ?? undefined} alt={peerName} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground uppercase">
                        {peerInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-white/90 font-semibold text-sm sm:text-base truncate">{peerName}</h2>
                      </div>
                      <p className="text-xs text-white/50" suppressHydrationWarning>
                        {isPeerOnline ? "Online now" : `Last active ${formatRelativeTime(selectedConversation.other_last_seen_at ?? selectedConversation.updated_at)}`}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div ref={messageContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden">
                    {loadingThreadId === selectedThreadId && selectedMessages.length === 0 ? (
                      // Show loading state while fetching messages for the first time
                      <div className="flex-1 flex items-center justify-center min-h-[200px]">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="h-6 w-6 animate-spin text-white/60" />
                          <p className="text-white/50 text-sm">Loading messages...</p>
                        </div>
                      </div>
                    ) : (
                      <div className="px-2 sm:px-4 py-3 sm:py-4 space-y-2">
                        {threadPagination[selectedConversation.thread_id]?.hasMore && (
                          <div className="flex justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-white/70 hover:text-white/90 hover:bg-white/10 border border-white/20"
                              onClick={handleLoadOlderMessages}
                              disabled={loadingOlderMessages}
                            >
                              {loadingOlderMessages ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Loading…
                                </>
                              ) : (
                                "Load previous messages"
                              )}
                            </Button>
                          </div>
                        )}

                        {selectedMessages.map((message) => {
                        const isOwn = message.sender_id === viewer.id
                        const attachmentsForMessage = message.attachments ?? []
                        const hasImages = attachmentsForMessage.some(a => a.media_type === "image")
                        const hasAudio = attachmentsForMessage.some(a => a.media_type === "audio")
                        const isImageOnly = hasImages && !message.content
                        const isAudioOnly = hasAudio && !message.content && !hasImages
                        const isDeleting = deletingMessageId === message.id
                        
                        return (
                          <div key={message.id} className={cn("flex gap-1.5 sm:gap-2 group", isOwn ? "justify-end" : "justify-start")}>
                            <div
                              className={cn(
                                "rounded-2xl backdrop-blur-sm relative",
                                "max-w-[85%] sm:max-w-[70%] lg:max-w-[65%]",
                                isImageOnly || isAudioOnly ? "p-0" : "px-2.5 sm:px-3 py-2 sm:py-2.5",
                                isOwn
                                  ? "bg-gradient-to-br from-black/40 to-black/60 text-white"
                                  : "bg-gradient-to-br from-white/15 to-white/8 text-white",
                                isDeleting && "opacity-50",
                                isMobile && isOwn && !isDeleting && "select-none"
                              )}
                              onTouchStart={(e) => {
                                if (isOwn && !isDeleting && isMobile) {
                                  handleLongPressStart(message.id, e)
                                }
                              }}
                              onTouchMove={handleLongPressMove}
                              onTouchEnd={handleLongPressEnd}
                              onTouchCancel={handleLongPressEnd}
                            >
                              {isOwn && !isDeleting && (
                                <DropdownMenu open={isMobile ? longPressMenuOpen === message.id : undefined} onOpenChange={(open) => {
                                  if (isMobile && !open) {
                                    setLongPressMenuOpen(null)
                                  }
                                }}>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-white/70 hover:text-white/90 focus:outline-none focus-visible:outline-none active:outline-none cursor-pointer p-2 z-40 rounded-full"
                                      style={{
                                        background: 'radial-gradient(circle, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.03) 70%, transparent 100%)'
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                      }}
                                      onTouchStart={(e) => {
                                        e.stopPropagation()
                                      }}
                                    >
                                      <ChevronDown className="h-5 w-5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    side="bottom"
                                    sideOffset={8}
                                    className="bg-white/10 border border-white/20 backdrop-blur-xl"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteMessage(message.id)
                                      }}
                                      className="text-red-400 hover:text-red-300 hover:bg-red-500/20 cursor-pointer focus:text-red-300 focus:bg-red-500/20"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                                      Delete message
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                             <div className={cn(isImageOnly ? "" : "space-y-1.5 pr-12 sm:pr-14")}>
                                {message.content && (
                                  <p className={cn(
                                    "text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words",
                                    hasImages && "pr-12 sm:pr-14"
                                  )}>{linkifyText(message.content)}</p>
                                )}
                                {attachmentsForMessage.length > 0 && (
                                  <div className={cn(isImageOnly ? "" : "space-y-2", message.content && "mt-1.5")}>
                                  {attachmentsForMessage.map((attachment, attachmentIndex) => {
                                    const signedUrl = attachmentUrls[attachment.id]?.url
                                    if (attachment.media_type === "image") {
                                      return (
                                        <div key={`${message.id}-${attachment.id}-${attachmentIndex}`} className={cn(
                                          "overflow-hidden border border-white/20 bg-black/20 relative flex-shrink-0",
                                          isImageOnly ? "rounded-2xl" : "rounded-lg"
                                        )}>
                                          {signedUrl ? (
                                            <Image
                                              src={signedUrl}
                                              alt="Shared image"
                                              width={640}
                                              height={640}
                                              className="w-full h-auto object-cover max-h-[200px] sm:max-h-[280px] block"
                                              style={{ maxHeight: '280px' }}
                                            />
                                          ) : (
                                            <div className="h-32 flex items-center justify-center text-white/50 text-xs bg-white/5">
                                              Loading image…
                                            </div>
                                          )}
                                        </div>
                                      )
                                    }
                                    if (attachment.media_type === "audio") {
                                      const senderProfile = isOwn ? viewer : peerProfile
                                      const senderAvatar = isOwn ? viewer.profile_picture : peerAvatar
                                      const senderInitials = isOwn ? getInitials(viewer) : peerInitials
                                      const senderName = isOwn ? getDisplayName(viewer) : peerName
                                      const senderId = isOwn ? viewer.id : peerProfile?.id
                                      
                                      return (
                                        <div
                                          key={`${message.id}-${attachment.id}-${attachmentIndex}`}
                                          className="w-full"
                                        >
                                          <div className="p-3 space-y-2">
                                            <div className="flex items-center gap-3">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  handleAudioPlay(attachment.id)
                                                }}
                                                className="flex-shrink-0 relative"
                                              >
                                                <div className="relative">
                                                  <div className={cn(
                                                    "transition-transform",
                                                    playingAudio === attachment.id && "animate-spin"
                                                  )}
                                                  style={{
                                                    animationDuration: playingAudio === attachment.id ? '2s' : 'none'
                                                  }}
                                                  >
                                                    <Avatar className="h-10 w-10 border-2 border-white/20" userId={senderId}>
                                                      <AvatarImage src={senderAvatar ?? undefined} alt={senderName} />
                                                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm uppercase">
                                                        {senderInitials}
                                                      </AvatarFallback>
                                                    </Avatar>
                                                  </div>
                                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    {playingAudio === attachment.id ? (
                                                      <Pause className="h-5 w-5 text-white/90 drop-shadow-lg" />
                                                    ) : (
                                                      <Play className="h-5 w-5 text-white/90 drop-shadow-lg" />
                                                    )}
                                                  </div>
                                                </div>
                                              </button>
                                              <div className="flex-1" />
                                              <div className="font-mono text-sm text-white/80">
                                                {audioProgress[attachment.id]?.duration
                                                  ? `${formatAudioTime(audioProgress[attachment.id].current || 0)} / ${formatAudioTime(audioProgress[attachment.id].duration)}`
                                                  : `0:00 / —`
                                                }
                                              </div>
                                            </div>
                                            <div
                                              className="w-full h-2 bg-white/10 rounded-full mt-2 cursor-pointer relative group backdrop-blur-sm overflow-visible"
                                              onClick={(e) => {
                                                const audio = audioRefs.current[attachment.id]
                                                if (!audio || !audioProgress[attachment.id]?.duration) return
                                                
                                                const rect = e.currentTarget.getBoundingClientRect()
                                                const clickX = e.clientX - rect.left
                                                const percentage = clickX / rect.width
                                                const newTime = percentage * audioProgress[attachment.id].duration
                                                
                                                audio.currentTime = Math.max(0, Math.min(newTime, audio.duration))
                                                setAudioProgress(prev => ({
                                                  ...prev,
                                                  [attachment.id]: {
                                                    current: audio.currentTime,
                                                    duration: prev[attachment.id]?.duration || 0
                                                  }
                                                }))
                                              }}
                                            >
                                              <div
                                                className="h-full bg-gradient-to-r from-white via-white to-white transition-all duration-100 rounded-full shadow-[0_0_4px_rgba(255,255,255,0.5),0_0_8px_rgba(255,255,255,0.3)] relative"
                                                style={{
                                                  width: audioProgress[attachment.id]?.duration
                                                    ? `${(audioProgress[attachment.id].current / audioProgress[attachment.id].duration) * 100}%`
                                                    : '0%'
                                                }}
                                              >
                                                <div
                                                  className={cn(
                                                    "absolute right-0 top-1/2 w-8 h-8 bg-white/90 blur-lg rounded-full pointer-events-none",
                                                    playingAudio === attachment.id && "animate-edge-glow"
                                                  )}
                                                  style={{
                                                    transform: 'translate(50%, -50%)'
                                                  }}
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    }
                                    return (
                                      <div
                                        key={`${message.id}-${attachment.id}-${attachmentIndex}`}
                                        className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white/75 text-xs"
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <ImageIcon className="h-3.5 w-3.5 text-white/60" />
                                          <span>Attachment</span>
                                        </div>
                                      </div>
                                    )
                                    })}
                                  </div>
                                )}
                              </div>
                              <div className={cn(
                                "absolute text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5 rounded",
                                isImageOnly
                                  ? "bottom-1.5 right-1.5 bg-black/60 text-white/90 backdrop-blur-sm"
                                  : "bottom-1.5 right-1.5 text-white/40 px-1"
                              )}>
                                {formatTimestamp(message.created_at)}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      
                      {typingActive && (
                        <div className="flex gap-1.5 sm:gap-2 justify-start">
                          <div className="rounded-2xl bg-white/10 text-white/85 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-1">
                            <style dangerouslySetInnerHTML={{
                              __html: `
                                @keyframes typing-dot-bounce {
                                  0%, 60%, 100% {
                                    transform: translateY(0);
                                    opacity: 0.7;
                                  }
                                  30% {
                                    transform: translateY(-8px);
                                    opacity: 1;
                                  }
                                }
                              `
                            }} />
                            <span
                              className="inline-block w-2 h-2 rounded-full bg-white/60"
                              style={{
                                animation: 'typing-dot-bounce 1.4s infinite ease-in-out',
                                animationDelay: '0s'
                              }}
                            />
                            <span
                              className="inline-block w-2 h-2 rounded-full bg-white/60"
                              style={{
                                animation: 'typing-dot-bounce 1.4s infinite ease-in-out',
                                animationDelay: '0.2s'
                              }}
                            />
                            <span
                              className="inline-block w-2 h-2 rounded-full bg-white/60"
                              style={{
                                animation: 'typing-dot-bounce 1.4s infinite ease-in-out',
                                animationDelay: '0.4s'
                              }}
                            />
                          </div>
                        </div>
                      )}
                      
                        <div className="h-1" />
                      </div>
                    )}
                  </div>
                  <Separator className="bg-white/10" />
                  <div className="p-3 sm:p-4 space-y-3">
                    {selectedConversation.participant_status === "blocked" && (
                      <div className="bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white/70 text-sm">
                        <div>
                          You cannot send messages in this conversation.
                        </div>
                      </div>
                    )}
                    {attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {attachments.map((attachment, index) => (
                          <div
                            key={`upload-${attachment.id}-${index}`}
                            className={cn(
                              "relative rounded-xl border px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center gap-2 text-xs",
                              attachment.status === "error"
                                ? "border-rose-400 text-rose-200 bg-rose-500/15"
                                : "border-white/20 text-white/75 bg-white/10",
                            )}
                          >
                            {attachment.previewUrl && (
                              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg overflow-hidden border border-white/20 bg-black/20 flex-shrink-0">
                                <Image
                                  src={attachment.previewUrl}
                                  alt={attachment.fileName}
                                  width={48}
                                  height={48}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            )}
                            <div className="max-w-[160px] truncate">{attachment.fileName}</div>
                            {attachment.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-white/60" />}
                            {attachment.status === "error" && <span className="text-rose-200 text-[10px]">Upload failed</span>}
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(attachment.id)}
                              className="ml-1 rounded-full bg-white/10 hover:bg-white/20 p-1 text-white/60 hover:text-white/90 transition"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div
                      className={cn(
                        "flex items-end gap-2 sm:gap-3 bg-white/10 border border-white/20 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3",
                        composerDisabled && "opacity-60 pointer-events-none",
                      )}
                    >
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        <label
                          className="rounded-full bg-white/10 border border-white/20 text-white/70 hover:text-white/90 hover:bg-white/15 cursor-pointer transition flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center"
                          title="Attach images"
                        >
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleAddFiles(event.target.files ? Array.from(event.target.files) : null, "image")}
                          />
                          <ImageIcon className="h-4 w-4" />
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="rounded-full border border-white/20 bg-white/10 text-white/70 hover:bg-white/15 hover:text-white/90 h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0"
                          onClick={() => setIsVoiceRecorderOpen(true)}
                        >
                          <Mic className="h-4 w-4" />
                        </Button>
                      </div>
                      <textarea
                        ref={textareaRef}
                        value={composerValue}
                        onChange={(event) => handleComposerChange(event.target.value)}
                        placeholder={
                          selectedConversation.participant_status === "blocked"
                            ? "Cannot send messages"
                            : "Type a message"
                        }
                        className="flex-1 bg-transparent border-0 resize-none outline-none text-sm sm:text-[15px] text-white/80 placeholder:text-white/40 max-h-24 sm:max-h-32 min-h-[32px] leading-[1.4] overflow-y-auto pt-1.5 pb-0.5 sm:pt-0.5 sm:pb-1.5"
                        rows={1}
                        onKeyDown={(event) => {
                          // On mobile: Enter creates new line, Shift+Enter sends
                          // On desktop: Enter sends, Shift+Enter creates new line
                          if (event.key === "Enter") {
                            if (isMobile) {
                              // On mobile, allow Enter to create new line (default behavior)
                              // Only prevent default and send if Shift+Enter is pressed
                              if (event.shiftKey) {
                                event.preventDefault()
                                handleSendMessage()
                              }
                              // Otherwise, let Enter create a new line (no preventDefault)
                            } else {
                              // On desktop, Enter sends, Shift+Enter creates new line
                              if (!event.shiftKey) {
                                event.preventDefault()
                                handleSendMessage()
                              }
                              // If Shift+Enter, allow default behavior (new line)
                            }
                          }
                        }}
                      />
                      <Button
                        type="button"
                        disabled={isSending || composerDisabled}
                        onClick={handleSendMessage}
                        className="rounded-full border border-white/20 bg-white/10 text-white/70 hover:bg-white/15 hover:text-white/90 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center flex-shrink-0 transition-colors"
                      >
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin text-white/70" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12 gap-4">
                <div className="h-14 w-14 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/70">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-white/90 text-lg font-semibold">Your inbox is ready</h3>
                  <p className="text-white/50 text-sm max-w-sm mx-auto">
                    Start a conversation by messaging someone. Messages appear here instantly with realtime updates.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isVoiceRecorderOpen} onOpenChange={setIsVoiceRecorderOpen}>
        <DialogContent className="bg-white/10 border border-white/20 backdrop-blur-xl text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white/90">Record a voice note</DialogTitle>
            <DialogDescription className="sr-only">
              Capture an audio message to share in this conversation.
            </DialogDescription>
          </DialogHeader>
          <VoiceNoteRecorder onRecordingComplete={handleVoiceNoteComplete} onCancel={handleVoiceNoteCancel} autoStart />
        </DialogContent>
      </Dialog>

    </div>
  )
}

