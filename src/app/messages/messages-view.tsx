"use client"

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { Loader2, MessageCircle } from "lucide-react"
import { toast } from "sonner"

import { supabase } from "@/lib/supabase"
import {
  DM_TYPING_EVENT,
  buildDmMediaStoragePath,
  getThreadChannelName,
  type ConversationListItem,
  type MessageResult,
} from "@/lib/chat-shared"
import { cn, formatRelativeTime } from "@/lib/utils"
import { useUnreadMessagesPerThread } from "@/hooks/use-unread-messages-per-thread"
import { Separator } from "@/components/ui/separator"
import type { ViewerProfile, AttachmentState, ThreadPaginationState } from "./types"
import { getDisplayName, getInitials, storagePathToObjectPath } from "./utils"
import { useSwipeToReply } from "./hooks/use-swipe-to-reply"
import { useLongPress } from "./hooks/use-long-press"
import { useAttachmentUrls } from "./hooks/use-attachment-urls"
import { useConversationSearch } from "./hooks/use-conversation-search"
import { useTypingIndicators } from "./hooks/use-typing-indicators"
import { useConversations } from "./hooks/use-conversations"
import { useMessageSending } from "./hooks/use-message-sending"
import { useRealtimeSubscriptions } from "./hooks/use-realtime-subscriptions"
import { ConversationList } from "./components/conversation-list"
import { ConversationHeader } from "./components/conversation-header"
import { MessageList } from "./components/message-list"
import { MessageComposer } from "./components/message-composer"

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

export default function MessagesView({
  viewer,
  initialConversations,
  initialThreadId,
  initialMessagesByThread,
  initialPaginationByThread,
}: MessagesViewProps) {
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [mobileView, setMobileView] = useState<"list" | "conversation">("list")
  
  // UI state
  const [composerValue, setComposerValue] = useState("")
  const [attachments, setAttachments] = useState<AttachmentState[]>([])
  const [replyingToMessage, setReplyingToMessage] = useState<MessageResult | null>(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [isVoiceRecorderOpen, setIsVoiceRecorderOpen] = useState(false)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)
  const [longPressMenuOpen, setLongPressMenuOpen] = useState<string | null>(null)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState<Array<{ id: string; url: string }>>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [conversationImagePreviews, setConversationImagePreviews] = useState<Record<string, { url: string; expiresAt: number }>>({})
  
  // Refs
  const videoRefs = useRef<Record<string, HTMLVideoElement>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const messageContainerRef = useRef<HTMLDivElement | null>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const highlightedMessageIdRef = useRef<string | null>(null)
  const attachmentsRef = useRef<AttachmentState[]>(attachments)
  const lastThreadFromQueryRef = useRef<string | null>(null)
  const hasInitializedRef = useRef(false)

  // Mobile detection
  useEffect(() => {
    setIsClient(true)
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Cleanup attachments on unmount
  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl)
        }
      })
    }
  }, [])

  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  // Initialize refs
  const conversationsRef = useRef<ConversationListItem[]>(initialConversations)
  const messagesRef = useRef<Record<string, MessageResult[]>>(initialMessagesByThread)
  const selectedThreadIdRef = useRef<string | null>(initialThreadId)
  const mobileViewRef = useRef<"list" | "conversation">(mobileView)
  const isMobileRef = useRef(isMobile)

  // Attachment URLs hook (needs to be initialized early)
  const { attachmentUrls, ensureAttachmentUrls } = useAttachmentUrls()

  // Conversation management hook
  const {
    conversations,
    setConversations,
    selectedThreadId,
    setSelectedThreadId,
    messagesByThread,
    setMessagesByThread,
    threadPagination,
    setThreadPagination,
    loadingThreadId,
    mobileView: mobileViewFromHook,
    setMobileView: setMobileViewFromHook,
    refreshConversations,
    prefetchMessages,
    handleSelectConversation,
  } = useConversations({
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
  })

  // Update mobileView from hook
  useEffect(() => {
    setMobileView(mobileViewFromHook)
  }, [mobileViewFromHook])

  // Update attachment URLs hook with current data
  useEffect(() => {
    const selectedMessages = selectedThreadId ? messagesByThread[selectedThreadId] ?? [] : []
    if (selectedMessages.length > 0) {
      ensureAttachmentUrls(selectedMessages.flatMap((message) => message.attachments ?? []))
    }
  }, [selectedThreadId, messagesByThread, ensureAttachmentUrls])

  useEffect(() => {
    if (replyingToMessage?.attachments?.length) {
      ensureAttachmentUrls(replyingToMessage.attachments)
    }
  }, [replyingToMessage?.attachments, ensureAttachmentUrls])

  useEffect(() => {
    if (!selectedThreadId) return
    const threadMessages = messagesByThread[selectedThreadId] ?? []
    const repliedAttachments: MessageResult["attachments"] = []
    threadMessages.forEach(message => {
      if (message.replied_to_message?.attachments) {
        repliedAttachments.push(...message.replied_to_message.attachments)
      }
    })
    
    if (repliedAttachments.length > 0) {
      ensureAttachmentUrls(repliedAttachments)
    }
  }, [selectedThreadId, messagesByThread, ensureAttachmentUrls])

  // Conversation search hook
  const { searchTerm, setSearchTerm, searchLoading, displayedConversations } = useConversationSearch(conversations)

  // Typing indicators hook
  const channelRef = useRef<RealtimeChannel | null>(null)
  const typingDisplayTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({})
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const {
    typingIndicators,
    setTypingIndicators,
    displayTypingIndicators,
    setDisplayTypingIndicators,
    notifyTyping,
    scheduleTypingBroadcast,
  } = useTypingIndicators(channelRef as React.MutableRefObject<RealtimeChannel | null>, viewer.id, selectedThreadId)

  // Presence map state
  const [presenceMap, setPresenceMap] = useState<Record<string, boolean>>({})

  // Message sending hook
  const { isSending, handleSendMessage } = useMessageSending({
    viewerId: viewer.id,
    selectedThreadId,
    displayedConversations,
    messagesByThread,
    setMessagesByThread,
    setConversations,
    ensureAttachmentUrls,
    handleSelectConversation,
    refreshConversations,
    notifyTyping,
    typingDisplayTimeoutRef,
    messageContainerRef,
    conversationsRef,
    initialThreadId,
  })

  // Get unread message counts per thread
  const threadIds = conversations.map((c) => c.thread_id)
  const { unreadCounts } = useUnreadMessagesPerThread(viewer.id, threadIds)

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Swipe to reply hook
  const {
    swipeOffset,
    swipingMessageId,
    handleSwipeStart: handleSwipeStartBase,
    handleSwipeMove: handleSwipeMoveBase,
    handleSwipeEnd: handleSwipeEndBase,
  } = useSwipeToReply(isMobile, longPressMenuOpen)

  // Long press hook
  const { handleLongPressStart, handleLongPressMove, handleLongPressEnd } = useLongPress(
    isMobile,
    useCallback((messageId: string) => {
      setLongPressMenuOpen(messageId)
    }, [])
  )

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.thread_id === selectedThreadId) ?? null,
    [conversations, selectedThreadId],
  )

  const selectedMessages = useMemo(
    () => selectedThreadId ? messagesByThread[selectedThreadId] ?? [] : [],
    [selectedThreadId, messagesByThread]
  )

  // Compute live previews from actual messages in threads
  const liveMessagePreviews = useMemo(() => {
    const previews: Record<string, { content: string; senderId: string | null; timestamp: string | null; hasImage: boolean }> = {}
    
    Object.entries(messagesByThread).forEach(([threadId, messages]) => {
      if (messages && messages.length > 0) {
        const lastMessage = messages[messages.length - 1]
        const imageAttachments = lastMessage.attachments?.filter(a => a.media_type === "image") ?? []
        const hasImage = imageAttachments.length > 0
        previews[threadId] = {
          content: lastMessage.content ?? (hasImage ? "[image]" : (lastMessage.attachments?.length ? "[attachment]" : "")),
          senderId: lastMessage.sender_id,
          timestamp: lastMessage.created_at,
          hasImage,
        }
      }
    })
    
    return previews
  }, [messagesByThread])

  // Fetch image previews for conversations with image attachments
  useEffect(() => {
    const fetchImagePreviews = async () => {
      const now = Date.now()
      const threadsToFetch: string[] = []

      // Check which conversations need image previews
      conversations.forEach((conversation) => {
        const threadId = conversation.thread_id
        const existing = conversationImagePreviews[threadId]
        
        // Skip if we already have a valid URL
        if (existing && existing.expiresAt > now + SIGNED_URL_REFRESH_THRESHOLD * 1000) {
          return
        }

        // Check if this conversation has an image in the last message
        const livePreview = liveMessagePreviews[threadId]
        const hasImage = livePreview?.hasImage || false
        
        // Also check if the preview text indicates an image
        const previewText = livePreview?.content || conversation.last_message_preview || ""
        const isImageMessage = previewText === "[image]" || previewText === "[attachment]"
        
        if (hasImage || isImageMessage) {
          threadsToFetch.push(threadId)
        }
      })

      if (threadsToFetch.length === 0) return

      // Fetch the last message with image attachments for each thread
      await Promise.all(
        threadsToFetch.map(async (threadId) => {
          try {
            const { data: lastMessage } = await supabase
              .from("dm_messages")
              .select("id")
              .eq("thread_id", threadId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()

            if (!lastMessage) return

            const { data: imageAttachments } = await supabase
              .from("dm_message_media")
              .select("id, storage_path, media_type")
              .eq("message_id", lastMessage.id)
              .eq("media_type", "image")
              .limit(1)

            if (!imageAttachments || imageAttachments.length === 0) return

            const imageAttachment = imageAttachments[0]
            const objectPath = storagePathToObjectPath(imageAttachment.storage_path)
            if (!objectPath) return

            const { data: signedUrlData } = await supabase.storage
              .from("dm-media")
              .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS)

            if (signedUrlData?.signedUrl) {
              setConversationImagePreviews((prev) => ({
                ...prev,
                [threadId]: {
                  url: signedUrlData.signedUrl,
                  expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000,
                },
              }))
            }
          } catch (error) {
            console.error(`[fetchImagePreviews] Error fetching preview for thread ${threadId}:`, error)
          }
        }),
      )
    }

    fetchImagePreviews()
  }, [conversations, liveMessagePreviews, conversationImagePreviews])

  // Auto-select first conversation if none selected
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

  // Scroll to bottom when thread changes
  useEffect(() => {
    if (!selectedThreadId) return
    const container = messageContainerRef.current
    if (!container) return
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight
    })
  }, [selectedThreadId])

  // Scroll to bottom when new messages arrive (only if user is near bottom)
  useEffect(() => {
    if (!selectedThreadId) return
    const container = messageContainerRef.current
    if (!container) return
    // Only auto-scroll if user is near the bottom (within 100px)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
    if (isNearBottom) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight
      })
    }
  }, [selectedMessages.length, selectedThreadId])


  // Voice note audio elements are now managed by VoiceNotePlayer component

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

  // Sync mobile view with URL state (handles browser back button)
  // Use refs to avoid infinite loops when updating state
  const prevThreadParamRef = useRef<string | null>(null)
  
  useEffect(() => {
    if (!isClient || !isMobile || !hasInitializedRef.current) return
    
    const threadParam = searchParams?.get("thread")?.trim() || null
    
    // Only sync if the thread param actually changed
    if (threadParam === prevThreadParamRef.current) return
    
    prevThreadParamRef.current = threadParam
    
    // If no thread param, ensure we're on list view
    if (!threadParam) {
      // Only update if current state doesn't match
      if (mobileViewFromHook !== "list") {
        startTransition(() => {
          setMobileViewFromHook("list")
        })
      }
      // Only clear selectedThreadId if it's set
      if (selectedThreadIdRef.current) {
        startTransition(() => {
          setSelectedThreadId(null)
          lastThreadFromQueryRef.current = null
        })
      }
    } else {
      // If thread param exists and matches selected thread, ensure we're on conversation view
      const currentSelectedId = selectedThreadIdRef.current
      if (threadParam === currentSelectedId && mobileViewFromHook !== "conversation") {
        startTransition(() => {
          setMobileViewFromHook("conversation")
        })
      }
    }
  }, [isClient, isMobile, searchParams, mobileViewFromHook, setMobileViewFromHook, setSelectedThreadId])

  useEffect(() => {
    const params = searchParams
    if (!params || !isClient) return

    // Don't auto-open on initial load - only respect query params after user has interacted
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      // Clear thread param from URL on initial load to prevent auto-opening
      const threadParam = params.get("thread")?.trim()
      const peerParam = params.get("peerId")?.trim()
      if (threadParam && !peerParam) {
        const nextParams = new URLSearchParams(params.toString())
        nextParams.delete("thread")
        const queryString = nextParams.toString()
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
        return
      }
    }

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
  }, [handleSelectConversation, refreshConversations, searchParams, selectedThreadId, isClient, router, pathname])

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

  // Mark messages as read when viewing them
  const markMessagesAsRead = useCallback(async (threadId: string, messageIds: string[]) => {
    if (messageIds.length === 0) return
    
    try {
      const response = await fetch(`/api/dm/threads/${threadId}/messages/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds }),
      })

      if (!response.ok) {
        throw new Error("Failed to mark messages as read")
      }

      // Update read receipts in local state
      setMessagesByThread((prev) => {
        const messages = prev[threadId] ?? []
        const now = new Date().toISOString()
        const otherUserId = selectedConversation?.other_user_id
        
        return {
          ...prev,
          [threadId]: messages.map((msg) => {
            // Only update read receipts for messages sent by the other user
            if (msg.sender_id !== viewer.id && messageIds.includes(msg.id) && otherUserId) {
              const existingReceipt = msg.read_receipts?.find((r) => r.user_id === viewer.id)
              if (!existingReceipt) {
                return {
                  ...msg,
                  read_receipts: [
                    ...(msg.read_receipts ?? []),
                    {
                      id: `temp-${msg.id}-${viewer.id}`,
                      message_id: msg.id,
                      user_id: viewer.id,
                      read_at: now,
                    },
                  ],
                }
              }
            }
            return msg
          }),
        }
      })
    } catch (error) {
      console.error("[markMessagesAsRead] Error:", error)
    }
  }, [viewer.id, selectedConversation])

  useEffect(() => {
    if (!selectedConversation || !selectedThreadId) return
    
    // Only mark messages as read if the conversation is actively being viewed
    // On mobile, check if we're in conversation view (not list view)
    if (isMobile && mobileView !== "conversation") {
      return
    }
    
    const lastMessageAt = selectedConversation.last_message_at
    const lastReadAt = selectedConversation.last_read_at
    const unread =
      lastMessageAt && (!lastReadAt || new Date(lastMessageAt).getTime() > new Date(lastReadAt).getTime())

    if (unread) {
      handleMarkThreadRead(selectedThreadId)
    }

    // Mark all unread messages from the other user as read
    const messages = messagesByThread[selectedThreadId] ?? []
    const unreadMessageIds = messages
      .filter((msg) => {
        // Only mark messages from the other user as read
        if (msg.sender_id === viewer.id) return false
        // Check if already read
        const isRead = msg.read_receipts?.some((r) => r.user_id === viewer.id)
        return !isRead
      })
      .map((msg) => msg.id)

    if (unreadMessageIds.length > 0) {
      markMessagesAsRead(selectedThreadId, unreadMessageIds)
    }
  }, [selectedConversation, selectedThreadId, handleMarkThreadRead, messagesByThread, viewer.id, markMessagesAsRead, isMobile, mobileView])

  // Realtime subscriptions hook
  const { channelRef: realtimeChannelRef, messagesChannelRef, threadsChannelRef } = useRealtimeSubscriptions({
    selectedThreadId,
    selectedConversation,
    viewerId: viewer.id,
    messagesByThread,
    setMessagesByThread,
    setConversations,
    setTypingIndicators,
    setDisplayTypingIndicators,
    setPresenceMap,
    ensureAttachmentUrls,
    markMessagesAsRead,
    refreshConversations,
    selectedThreadIdRef,
    mobileViewRef,
    isMobileRef,
    messagesRef,
    conversationsRef,
    typingDisplayTimeoutRef,
  })

  // Update channelRef for typing indicators
  useEffect(() => {
    if (realtimeChannelRef.current) {
      channelRef.current = realtimeChannelRef.current
    }
  }, [realtimeChannelRef])


  // Function to scroll to a message and highlight it
  const scrollToMessage = useCallback(async (messageId: string) => {
    const normalizedThreadId = selectedThreadId?.trim()
    if (!normalizedThreadId) return

    // Check if message exists in current messages
    const currentMessages = messagesByThread[normalizedThreadId] ?? []
    const messageExists = currentMessages.some(m => m.id === messageId)
    
    // If message doesn't exist and there are more messages to load, load them
    if (!messageExists) {
      const pagination = threadPagination[normalizedThreadId]
      if (pagination?.hasMore && !loadingOlderMessages) {
        // Load older messages until we find the target message or run out of messages
        let found = false
        let hasMore: boolean = pagination.hasMore
        let nextCursor = pagination.nextCursor
        let loadAttempts = 0
        const MAX_LOAD_ATTEMPTS = 20 // Safety limit to prevent infinite loops
        
        while (!found && hasMore && !loadingOlderMessages && loadAttempts < MAX_LOAD_ATTEMPTS) {
          loadAttempts++
          try {
            setLoadingOlderMessages(true)
            const params = new URLSearchParams()
            params.set("limit", String(DEFAULT_PAGE_SIZE))
            if (nextCursor) {
              params.set("before", nextCursor)
            }

            const response = await fetch(`/api/dm/threads/${normalizedThreadId}/messages?${params.toString()}`, {
              cache: "no-store",
            })
            if (!response.ok) {
              throw new Error("Failed to load older messages")
            }
            const data = await response.json()
            const fetchedMessages: MessageResult[] = data.messages ?? []
            
            // Check if target message is in fetched messages
            found = fetchedMessages.some(m => m.id === messageId)
            
            setMessagesByThread((prev) => ({
              ...prev,
              [normalizedThreadId]: [...fetchedMessages, ...(prev[normalizedThreadId] ?? [])],
            }))
            
            hasMore = Boolean(data.pageInfo?.hasMore)
            nextCursor = data.pageInfo?.nextCursor ?? null
            
            setThreadPagination((prev) => ({
              ...prev,
              [normalizedThreadId]: {
                hasMore,
                nextCursor,
              },
            }))
            
            ensureAttachmentUrls(fetchedMessages.flatMap((m) => m.attachments ?? []))
            
            // Wait a bit for DOM to update
            await new Promise(resolve => setTimeout(resolve, 100))
          } catch (error) {
            console.error("Error loading older messages:", error)
            setLoadingOlderMessages(false)
            return
          } finally {
            setLoadingOlderMessages(false)
          }
        }
      }
    }

    // Now try to scroll to the message
    const attemptScroll = () => {
      const messageElement = messageRefs.current.get(messageId)
      const container = messageContainerRef.current
      
      if (!messageElement || !container) {
        // If still not found, try again after a short delay
        setTimeout(() => {
          attemptScroll()
        }, 100)
        return
      }
      
      // Highlight the message first
      setHighlightedMessageId(messageId)
      highlightedMessageIdRef.current = messageId
      
      // Use requestAnimationFrame to ensure DOM is updated before scrolling
      requestAnimationFrame(() => {
        // Scroll to message with better positioning
        messageElement.scrollIntoView({ 
          behavior: "smooth", 
          block: "center",
          inline: "nearest"
        })
        
        // Also try scrolling the container if needed (for better centering)
        setTimeout(() => {
          const elementRect = messageElement.getBoundingClientRect()
          const containerRect = container.getBoundingClientRect()
          const elementCenter = elementRect.top + elementRect.height / 2
          const containerCenter = containerRect.top + containerRect.height / 2
          const scrollOffset = elementCenter - containerCenter
          
          if (Math.abs(scrollOffset) > 10) {
            container.scrollBy({
              top: scrollOffset,
              behavior: "smooth"
            })
          }
        }, 100)
      })
      
      // Remove highlight after 2 seconds
      setTimeout(() => {
        setHighlightedMessageId(null)
        highlightedMessageIdRef.current = null
      }, 2000)
    }
    
    // Wait a bit for DOM to update after loading messages
    setTimeout(() => {
      attemptScroll()
    }, 150)
  }, [selectedThreadId, messagesByThread, threadPagination, loadingOlderMessages, ensureAttachmentUrls])


  // Handle emoji selection
  const handleEmojiSelect = useCallback((emoji: string) => {
    if (!textareaRef.current) return
    
    const textarea = textareaRef.current
    // Focus the textarea first to ensure selection is valid
    textarea.focus()
    
    // Get cursor position (default to end if no selection)
    const start = textarea.selectionStart ?? composerValue.length
    const end = textarea.selectionEnd ?? composerValue.length
    const textBefore = composerValue.substring(0, start)
    const textAfter = composerValue.substring(end)
    
    const newValue = textBefore + emoji + textAfter
    setComposerValue(newValue)
    
    // Set cursor position after the inserted emoji
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPosition = start + emoji.length
        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition)
        textareaRef.current.focus()
      }
    }, 0)
  }, [composerValue])

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
      setReplyingToMessage(null)
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

  // Map file extensions to MIME types
  const getMimeTypeFromExtension = useCallback((extension: string, detectedType: string | undefined, mediaType: AttachmentState["mediaType"]): string => {
    const extensionMap: Record<string, string> = {
      // Images - All major formats
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      bmp: "image/bmp",
      svg: "image/svg+xml",
      tiff: "image/tiff",
      tif: "image/tiff",
      ico: "image/x-icon",
      heic: "image/heic",
      heif: "image/heif",
      avif: "image/avif",
      // Audio
      ogg: "audio/ogg",
      mp3: "audio/mpeg",
      mpeg: "audio/mpeg",
      wav: "audio/wav",
      aac: "audio/aac",
      flac: "audio/flac",
      m4a: "audio/mp4",
      opus: "audio/opus",
      // Documents
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      txt: "text/plain",
      rtf: "application/rtf",
      // Videos
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      avi: "video/x-msvideo",
      mkv: "video/x-matroska",
      m4v: "video/x-m4v",
    }
    
    const ext = extension.toLowerCase()
    const mimeFromExtension = extensionMap[ext]
    
    // ALWAYS prioritize extension-based detection for known extensions
    // This prevents browser misdetection (e.g., detecting images as application/json)
    if (mimeFromExtension) {
      console.log(`[MIME Detection] Using extension-based MIME type: ${mimeFromExtension} (ext: ${ext}, detected: ${detectedType || "none"})`)
      return mimeFromExtension
    }
    
    // If no extension mapping, try to use detected type if it's valid
    if (detectedType && detectedType !== "application/json" && detectedType !== "application/octet-stream") {
      // Check if detected type is valid for the media type
      if (mediaType === "image" && detectedType.startsWith("image/")) {
        console.log(`[MIME Detection] Using detected image MIME type: ${detectedType}`)
        return detectedType
      }
      if (mediaType === "audio" && detectedType.startsWith("audio/")) {
        console.log(`[MIME Detection] Using detected audio MIME type: ${detectedType}`)
        return detectedType
      }
      if (mediaType === "video" && detectedType.startsWith("video/")) {
        console.log(`[MIME Detection] Using detected video MIME type: ${detectedType}`)
        return detectedType
      }
      if (mediaType === "file" && (detectedType.startsWith("application/") || detectedType.startsWith("text/"))) {
        console.log(`[MIME Detection] Using detected document MIME type: ${detectedType}`)
        return detectedType
      }
      if (detectedType === "application/pdf") {
        console.log(`[MIME Detection] Using detected PDF MIME type: ${detectedType}`)
        return detectedType
      }
    }
    
    // Default based on media type as last resort
    console.warn(`[MIME Detection] No extension mapping found, using default for media type: ${mediaType}`)
    if (mediaType === "image") {
      return "image/jpeg" // Default to JPEG for images
    }
    if (mediaType === "audio") {
      return "audio/webm" // Default to WebM for audio
    }
    if (mediaType === "video") {
      return "video/mp4" // Default to MP4 for video
    }
    if (mediaType === "file") {
      return "application/octet-stream" // Default for documents
    }
    
    return "application/octet-stream"
  }, [])

  const handleAddFiles = useCallback(
    async (files: File[] | null, mediaType: AttachmentState["mediaType"]) => {
      console.log('[handleAddFiles] CALLED with:', {
        filesCount: files?.length || 0,
        mediaType,
        currentAttachmentsCount: attachmentsRef.current.length,
        files: files?.map(f => ({ name: f.name, type: f.type, size: f.size }))
      })
      
      if (!files || files.length === 0) {
        console.log('[handleAddFiles] No files provided, returning early')
        return
      }
      
      const remainingSlots = MAX_ATTACHMENTS - attachmentsRef.current.length
      console.log('[handleAddFiles] Remaining slots:', remainingSlots)
      
      if (remainingSlots <= 0) {
        console.log('[handleAddFiles] No remaining slots, showing error')
        toast.error(`You can attach up to ${MAX_ATTACHMENTS} files per message.`)
        return
      }

      // Validate file sizes before processing
      const MAX_FILE_SIZE_VIDEO = 50 * 1024 * 1024 // 50MB for videos
      const MAX_FILE_SIZE_OTHER = 25 * 1024 * 1024 // 25MB for other file types
      
      const validFiles: File[] = []
      for (const file of files) {
        const maxSize = mediaType === "video" ? MAX_FILE_SIZE_VIDEO : MAX_FILE_SIZE_OTHER
        if (file.size > maxSize) {
          const maxSizeMB = mediaType === "video" ? 50 : 25
          const fileSizeMB = (file.size / 1024 / 1024).toFixed(2)
          toast.error(`${mediaType === "video" ? "Video" : "File"} "${file.name}" is too large (max ${maxSizeMB}MB). Your file is ${fileSizeMB}MB`)
          continue // Skip this file but continue with others
        }
        validFiles.push(file)
      }
      
      if (validFiles.length === 0) {
        console.log('[handleAddFiles] No valid files after size validation')
        return
      }

      const selected = validFiles.slice(0, remainingSlots)

      // Create all pending attachments first
      const pendingAttachments: AttachmentState[] = selected.map((file) => {
        const id = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
        // Create preview URL for images and videos immediately
        const previewUrl = (mediaType === "image" || mediaType === "video") ? URL.createObjectURL(file) : undefined

        return {
          id,
          fileName: file.name,
          mediaType,
          previewUrl: previewUrl || undefined, // Ensure it's explicitly set
          status: "uploading" as const,
        }
      })

      // Add all attachments at once so they show up immediately
      console.log('[handleAddFiles] About to call setAttachments with:', {
        pendingAttachmentsCount: pendingAttachments.length,
        pendingAttachments: pendingAttachments.map(a => ({
          id: a.id,
          fileName: a.fileName,
          mediaType: a.mediaType,
          status: a.status,
          hasPreviewUrl: !!a.previewUrl
        })),
        currentAttachmentsCount: attachments.length
      })
      
      setAttachments((prev) => {
        console.log('[handleAddFiles] setAttachments callback - prev state:', {
          prevCount: prev.length,
          prevAttachments: prev.map(a => ({ id: a.id, fileName: a.fileName }))
        })
        
        const updated = [...prev, ...pendingAttachments]
        // Update ref immediately
        attachmentsRef.current = updated
        
        console.log('[handleAddFiles] setAttachments callback - new state:', {
          updatedCount: updated.length,
          updatedAttachments: updated.map(a => ({
            id: a.id,
            fileName: a.fileName,
            mediaType: a.mediaType,
            status: a.status,
            hasPreviewUrl: !!a.previewUrl
          }))
        })
        
        return updated
      })
      
      console.log('[handleAddFiles] setAttachments called, attachments state should update')

      // Process each file for upload
      for (const file of selected) {
        const pendingAttachment = pendingAttachments.find(a => a.fileName === file.name)
        if (!pendingAttachment) continue

        try {
          // Extract file extension more robustly
          const fileName = file.name || "upload"
          const lastDotIndex = fileName.lastIndexOf(".")
          const extension = lastDotIndex > 0 && lastDotIndex < fileName.length - 1
            ? fileName.slice(lastDotIndex + 1).toLowerCase()
            : "bin"
          
          // Get MIME type from extension, validating against detected type
          const detectedMimeType = file.type || ""
          let mimeType = getMimeTypeFromExtension(extension, detectedMimeType, mediaType)
          
          // For JPG/JPEG files, ensure we use image/jpeg (standard MIME type)
          if ((extension === "jpg" || extension === "jpeg") && mimeType !== "image/jpeg") {
            console.warn(`[Message Upload] Correcting MIME type for ${fileName}: ${mimeType} -> image/jpeg`)
            mimeType = "image/jpeg"
          }
          
          // Validate MIME type is supported (client-side check)
          const allowedMimeTypes = [
            // Images - All major formats
            "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/bmp", 
            "image/svg+xml", "image/tiff", "image/x-icon", "image/ico",
            "image/heic", "image/heif", "image/avif",
            // Audio
            "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp3", "audio/mp4",
            "audio/wav", "audio/aac", "audio/flac", "audio/opus",
            // Videos
            "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo",
            "video/x-matroska", "video/x-m4v",
            // Documents
            "application/pdf", "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "text/plain", "application/rtf"
          ]
          
          if (!allowedMimeTypes.includes(mimeType)) {
            throw new Error(`File type ${mimeType} is not supported. Supported formats: Images (JPEG, PNG, WebP, GIF, etc.), Audio (WebM, MP3, WAV, etc.), Video (MP4, WebM, MOV, etc.), or Documents (PDF, DOC, DOCX, etc.).`)
          }
          
          const { bucket, objectPath, storagePath } = buildDmMediaStoragePath(viewer.id, extension)
          
          console.log(`[Message Upload] Uploading file: ${fileName}, extension: ${extension}, detectedType: ${detectedMimeType}, mimeType: ${mimeType}, objectPath: ${objectPath}, fileSize: ${file.size}`)
          
          // Use the detected MIME type (should be image/jpeg for JPG files)
          const finalMimeType = mimeType
          
          // Upload options matching post upload pattern
          const uploadOptions = {
            contentType: finalMimeType,
            cacheControl: '0',
            upsert: false
          }
          
          console.log(`[Message Upload] Upload options:`, {
            ...uploadOptions,
            fileSize: file.size,
            fileName: file.name,
            fileTypeFromFile: file.type,
            detectedMimeType,
            finalMimeType,
          })
          
          // Upload the File directly (same pattern as posts) to preserve binary data integrity
          const { data: uploadData, error } = await supabase.storage
            .from(bucket)
            .upload(objectPath, file, uploadOptions)

          if (error) {
            // Log the complete error object to understand what's happening
            console.error(`[Message Upload] Upload error for ${fileName}:`, {
              error,
              errorMessage: error.message,
              errorName: error.name,
              errorStatus: (error as any).statusCode || (error as any).status || null,
              errorStack: error.stack,
              errorString: String(error),
              errorJSON: JSON.stringify(error, Object.getOwnPropertyNames(error)),
              uploadDetails: {
                fileName,
                extension,
                detectedMimeType,
                mimeType,
                finalMimeType,
                objectPath,
                fileSize: file.size,
                bucket,
                fileTypeFromFile: file.type,
              },
            })
            
            // Provide more specific error message based on the actual error
            let errorMessage = error.message || "Upload failed"
            
            // Check for MIME type errors - look for various error messages
            const errorMsg = error.message?.toLowerCase() || ""
            if (
              errorMsg.includes("mime type") || 
              errorMsg.includes("not supported") || 
              errorMsg.includes("allowed_mime_types") ||
              errorMsg.includes("content type") ||
              errorMsg.includes("invalid file type")
            ) {
              // This is a MIME type error from Supabase
              errorMessage = `File type "${finalMimeType}" is not supported. The storage bucket may need to be configured to accept ${finalMimeType} files. Detected: ${detectedMimeType || "unknown"}, Extension: ${extension}`
              console.error(`[Message Upload] MIME type validation failed. Sent: ${finalMimeType}, Detected: ${detectedMimeType}, Extension: ${extension}, Original file.type: ${file.type}`)
            } else if ((error as any).statusCode === "409" || (error as any).status === 409 || errorMsg.includes("already exists") || errorMsg.includes("duplicate")) {
              errorMessage = "File already exists"
            } else if ((error as any).statusCode === "413" || (error as any).status === 413 || errorMsg.includes("too large") || errorMsg.includes("file_size_limit") || errorMsg.includes("file size")) {
              const maxSizeMB = mediaType === "video" ? 50 : 25
              errorMessage = `File is too large (max ${maxSizeMB}MB for ${mediaType} files). Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`
            } else if ((error as any).statusCode === "403" || (error as any).status === 403 || errorMsg.includes("permission") || errorMsg.includes("forbidden") || errorMsg.includes("access denied")) {
              errorMessage = "Permission denied. Please check your account permissions."
            } else {
              // Use the exact error message from Supabase - this helps debug the actual issue
              errorMessage = error.message || "Upload failed"
            }
            
            throw new Error(errorMessage)
          }

          console.log(`[Message Upload] Successfully uploaded ${fileName} to ${objectPath}`)

          setAttachments((prev) =>
            prev.map((item) =>
              item.id === pendingAttachment.id
                ? {
                    ...item,
                    status: "ready",
                    storagePath,
                    objectPath,
                    mimeType: mimeType,
                    fileSize: file.size,
                    fileName: file.name, // Preserve original file name
                  }
                : item,
            ),
          )
        } catch (error: any) {
          console.error(`[Message Upload] Error uploading ${file.name}:`, error)
          const errorMessage = error?.message || error?.error?.message || "Upload failed"
          toast.error(`Failed to upload ${file.name}: ${errorMessage}`)
          setAttachments((prev) =>
            prev.map((item) =>
              item.id === pendingAttachment.id
                ? {
                    ...item,
                    status: "error",
                    error: errorMessage,
                  }
                : item,
            ),
          )
        }
      }
    },
    [viewer.id, getMimeTypeFromExtension],
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

  // Wrapper for handleSendMessage that handles composer state
  const handleSendMessageWrapper = useCallback(async () => {
    const trimmed = composerValue.trim()
    const readyAttachments = attachments.filter((attachment) => attachment.status === "ready")

    if (!trimmed && readyAttachments.length === 0) {
      toast.info("Type a message or add an attachment to send.")
      return
    }

    const resetComposer = () => {
      setComposerValue("")
      setAttachments([])
    }

    await handleSendMessage(trimmed, readyAttachments, replyingToMessage, resetComposer)
  }, [composerValue, attachments, replyingToMessage, handleSendMessage])

  // Wrapper for swipe end that handles reply
  const handleSwipeEnd = useCallback((messageId: string) => {
    handleSwipeEndBase(messageId, (msgId) => {
      const message = selectedMessages.find(m => m.id === msgId)
      if (message) {
        setReplyingToMessage(message)
        setTimeout(() => {
          const composer = document.querySelector('textarea[placeholder*="message"]') as HTMLTextAreaElement
          composer?.focus()
        }, 100)
      }
    })
  }, [handleSwipeEndBase, selectedMessages])

  const handleReply = useCallback((message: MessageResult) => {
    setReplyingToMessage(message)
    setTimeout(() => {
      const composer = document.querySelector('textarea[placeholder*="message"]') as HTMLTextAreaElement
      composer?.focus()
    }, 100)
  }, [])

  const handleDelete = useCallback(async (messageId: string) => {
    await handleDeleteMessage(messageId)
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
      const wasLastMessage = messagesByThread[selectedThreadId]?.length > 0 &&
        messagesByThread[selectedThreadId][messagesByThread[selectedThreadId].length - 1]?.id === messageId

      setMessagesByThread((prev) => ({
        ...prev,
        [selectedThreadId]: (prev[selectedThreadId] ?? []).filter((m) => m.id !== messageId),
      }))

      // If we deleted the last message, refresh the thread metadata from the database
      // The database trigger should have updated the thread's last_message_preview
      if (wasLastMessage) {
        const { data: threadData } = await supabase
          .from("dm_threads")
          .select("last_message_at, last_message_preview, last_message_sender_id, updated_at")
          .eq("id", selectedThreadId)
          .single()

        if (threadData) {
          setConversations((prev) =>
            prev
              .map((item) =>
                item.thread_id === selectedThreadId
                  ? {
                      ...item,
                      last_message_at: threadData.last_message_at,
                      last_message_preview: threadData.last_message_preview,
                      last_message_sender_id: threadData.last_message_sender_id,
                      updated_at: threadData.updated_at,
                    }
                  : item,
              )
              .sort((a, b) => {
                const aTime = new Date(a.last_message_at ?? a.updated_at).getTime()
                const bTime = new Date(b.last_message_at ?? b.updated_at).getTime()
                return bTime - aTime
              }),
          )
        }
      }

      toast.success("Message deleted")
    } catch (error) {
      console.error(error)
      toast.error("Failed to delete message")
    } finally {
      setDeletingMessageId(null)
    }
  }, [selectedThreadId, deletingMessageId, messagesByThread])

  // Voice note playback is now handled by VoiceNotePlayer component


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

  // Scroll to bottom when typing indicator appears (only if user is near bottom)
  useEffect(() => {
    if (!selectedThreadId || !typingActive) return
    const container = messageContainerRef.current
    if (!container) return
    // Only auto-scroll if user is near the bottom (within 100px)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
    if (isNearBottom) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight
      })
    }
  }, [typingActive, selectedThreadId])

  // Check scroll position to show/hide scroll to bottom button
  useEffect(() => {
    const container = messageContainerRef.current
    if (!container || !selectedThreadId) {
      setShowScrollToBottom(false)
      return
    }

    const checkScrollPosition = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
      setShowScrollToBottom(!isNearBottom)
    }

    container.addEventListener('scroll', checkScrollPosition)
    // Check after messages load
    setTimeout(checkScrollPosition, 100)

    return () => {
      container.removeEventListener('scroll', checkScrollPosition)
    }
  }, [selectedThreadId])

  // Re-check scroll position when messages change
  useEffect(() => {
    if (!selectedThreadId) return
    const container = messageContainerRef.current
    if (container) {
      const checkScrollPosition = () => {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
        setShowScrollToBottom(!isNearBottom)
      }
      setTimeout(checkScrollPosition, 100)
    }
  }, [selectedMessages, selectedThreadId])

  const scrollToBottom = useCallback(() => {
    const container = messageContainerRef.current
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [])

  const peerName = getDisplayName(peerProfile)
  const peerInitials = getInitials(peerProfile)
  const peerAvatar = peerProfile?.profile_picture ?? null
  const isPeerOnline = selectedThreadId ? presenceMap[selectedThreadId] ?? false : false
  // Only disable composer if participant is blocked
  const composerDisabled = selectedConversation?.participant_status === "blocked"

  const conversationsToRender = displayedConversations

  const handleBackToList = useCallback(() => {
    startTransition(() => {
      setMobileViewFromHook("list")
      setSelectedThreadId(null)
      lastThreadFromQueryRef.current = null
    })
    // Clear thread from URL
    const nextParams = new URLSearchParams(searchParams?.toString() ?? "")
    nextParams.delete("thread")
    nextParams.delete("peerId")
    const queryString = nextParams.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
  }, [setMobileViewFromHook, setSelectedThreadId, searchParams, router, pathname])

  const handleImageClick = useCallback((images: Array<{ id: string; url: string }>, index: number) => {
                                          setLightboxImages(images)
    setLightboxIndex(index)
                                          setLightboxOpen(true)
  }, [])

  const handleDownloadAttachment = useCallback(async (attachmentId: string) => {
    if (downloadingAttachmentId === attachmentId) return
    try {
      setDownloadingAttachmentId(attachmentId)
      const response = await fetch(`/api/dm/download/${attachmentId}`)
      if (!response.ok) throw new Error("Download failed")
                                          const blob = await response.blob()
                                          const url = window.URL.createObjectURL(blob)
                                          const link = document.createElement('a')
                                          link.href = url
      link.download = `attachment-${attachmentId}`
                                          link.style.display = 'none'
                                          document.body.appendChild(link)
                                          link.click()
                                          document.body.removeChild(link)
                                          window.URL.revokeObjectURL(url)
                                        } catch (error) {
                                          console.error("Download error:", error)
                                          toast.error("Failed to download file")
                                        } finally {
                                          setDownloadingAttachmentId(null)
                                        }
  }, [downloadingAttachmentId])
                                      
                                      return (
    <div className="flex flex-col h-[calc(100dvh-5rem-2.5rem)] lg:h-[calc(100dvh-5rem)] w-full">
      <div className="flex flex-col lg:flex-row gap-4 h-full overflow-hidden">
        <ConversationList
          conversations={conversationsToRender}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchLoading={searchLoading}
          selectedThreadId={selectedThreadId}
          onSelectConversation={handleSelectConversation}
          onPrefetchMessages={prefetchMessages}
          isMobile={isMobile}
          isClient={isClient}
          mobileView={mobileView}
          viewerId={viewer.id}
          unreadCounts={unreadCounts}
          typingIndicators={typingIndicators}
          presenceMap={presenceMap}
          conversationImagePreviews={conversationImagePreviews}
          liveMessagePreviews={liveMessagePreviews}
        />

                                  <div className={cn(
          "flex flex-col h-full overflow-hidden lg:flex-1",
          !isClient && "hidden lg:flex",
          isClient && isMobile && mobileView === "list" && "hidden lg:flex",
          isClient && isMobile && mobileView === "conversation" && "flex"
        )}>
          <div className="bg-white/10 border border-white/20 rounded-2xl backdrop-blur-md shadow-[0_20px_60px_-15px_rgba(0,0,0,0.45)] flex flex-col h-full">
            {selectedConversation ? (
              <>
                <ConversationHeader
                  conversation={selectedConversation}
                  isMobile={isMobile}
                  onBack={handleBackToList}
                  isPeerOnline={isPeerOnline}
                />
                
                {loadingThreadId === selectedThreadId && selectedMessages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center min-h-[200px]">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-white/60" />
                      <p className="text-white/50 text-sm">Loading messages...</p>
                    </div>
                  </div>
                ) : (
                  <MessageList
                    messages={selectedMessages}
                    viewer={viewer}
                    peerProfile={peerProfile}
                    peerName={peerName}
                    peerInitials={peerInitials}
                    peerAvatar={peerAvatar}
                    isMobile={isMobile}
                    highlightedMessageId={highlightedMessageId}
                    longPressMenuOpen={longPressMenuOpen}
                    onLongPressMenuChange={setLongPressMenuOpen}
                    onReply={handleReply}
                    onDelete={handleDelete}
                    onScrollToMessage={scrollToMessage}
                    attachmentUrls={attachmentUrls}
                    playingAudio={playingAudio}
                    playingVideo={playingVideo}
                    onAudioPlayStateChange={(id, playing) => setPlayingAudio(playing ? id : null)}
                    onVideoPlayStateChange={(id) => setPlayingVideo(id)}
                    videoRefs={videoRefs}
                    downloadingAttachmentId={downloadingAttachmentId}
                    onDownloadAttachment={handleDownloadAttachment}
                    swipeOffset={swipeOffset}
                    swipingMessageId={swipingMessageId}
                    onSwipeStart={(id, e) => {
                      handleLongPressStart(id, e)
                      handleSwipeStartBase(id, e)
                    }}
                    onSwipeMove={(e) => {
                      handleLongPressMove(e)
                      handleSwipeMoveBase(e)
                    }}
                    onSwipeEnd={(id, onReply) => {
                      handleLongPressEnd()
                      handleSwipeEnd(id)
                    }}
                    hasMore={threadPagination[selectedConversation.thread_id]?.hasMore ?? false}
                    loadingOlderMessages={loadingOlderMessages}
                    onLoadOlderMessages={handleLoadOlderMessages}
                    selectedConversation={selectedConversation}
                    messagesByThread={messagesByThread}
                    selectedThreadId={selectedThreadId}
                    lightboxOpen={lightboxOpen}
                    lightboxImages={lightboxImages}
                    lightboxIndex={lightboxIndex}
                    onLightboxOpenChange={setLightboxOpen}
                    onImageClick={handleImageClick}
                    deletingMessageId={deletingMessageId}
                  />
                )}
                      
                      {typingActive && (
                  <div className="px-2 sm:px-4 pb-2">
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
                      </div>
                    )}

                  <Separator className="bg-white/10" />
                
                <MessageComposer
                  composerValue={composerValue}
                  onComposerChange={handleComposerChange}
                  attachments={attachments}
                  onRemoveAttachment={handleRemoveAttachment}
                  onSendMessage={handleSendMessageWrapper}
                  isSending={isSending}
                  composerDisabled={composerDisabled}
                  replyingToMessage={replyingToMessage}
                  onCancelReply={() => setReplyingToMessage(null)}
                  onScrollToMessage={scrollToMessage}
                  attachmentUrls={attachmentUrls}
                  peerName={peerName}
                  viewerId={viewer.id}
                  isVoiceRecorderOpen={isVoiceRecorderOpen}
                  onVoiceRecorderOpen={setIsVoiceRecorderOpen}
                  onVoiceNoteComplete={handleVoiceNoteComplete}
                  onVoiceNoteCancel={handleVoiceNoteCancel}
                  onAddFiles={handleAddFiles}
                  fileInputRefs={fileInputRefs}
                  attachMenuOpen={attachMenuOpen}
                  onAttachMenuOpenChange={setAttachMenuOpen}
                          onEmojiSelect={handleEmojiSelect}
                  isMobile={isMobile}
                />
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
    </div>
  )
}

