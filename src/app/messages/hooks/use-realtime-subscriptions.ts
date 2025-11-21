"use client"

import { useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { DM_TYPING_EVENT, getThreadChannelName } from "@/lib/chat-shared"
import type { MessageResult, ConversationListItem } from "@/lib/chat-shared"
import type { ThreadPaginationState } from "../types"

const TYPING_EXPIRATION_MS = 4000

interface UseRealtimeSubscriptionsOptions {
  selectedThreadId: string | null
  selectedConversation: ConversationListItem | null
  viewerId: string
  messagesByThread: Record<string, MessageResult[]>
  setMessagesByThread: React.Dispatch<React.SetStateAction<Record<string, MessageResult[]>>>
  setConversations: React.Dispatch<React.SetStateAction<ConversationListItem[]>>
  setTypingIndicators: React.Dispatch<React.SetStateAction<Record<string, { userId: string; expiresAt: number }>>>
  setDisplayTypingIndicators: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  setPresenceMap: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  ensureAttachmentUrls: (attachments: MessageResult["attachments"]) => Promise<void>
  markMessagesAsRead: (threadId: string, messageIds: string[]) => Promise<void>
  refreshConversations: () => Promise<ConversationListItem[]>
  selectedThreadIdRef: React.MutableRefObject<string | null>
  mobileViewRef: React.MutableRefObject<"list" | "conversation">
  isMobileRef: React.MutableRefObject<boolean>
  messagesRef: React.MutableRefObject<Record<string, MessageResult[]>>
  conversationsRef: React.MutableRefObject<ConversationListItem[]>
  typingDisplayTimeoutRef: React.MutableRefObject<Record<string, NodeJS.Timeout>>
}

export function useRealtimeSubscriptions({
  selectedThreadId,
  selectedConversation,
  viewerId,
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
}: UseRealtimeSubscriptionsOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const messagesChannelRef = useRef<RealtimeChannel | null>(null)
  const threadsChannelRef = useRef<RealtimeChannel | null>(null)

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

  const cleanupThreadsChannel = useCallback(() => {
    if (threadsChannelRef.current) {
      try {
        supabase.removeChannel(threadsChannelRef.current)
      } catch (error) {
        console.error("[cleanupThreadsChannel] Error removing channel:", error)
      } finally {
        threadsChannelRef.current = null
      }
    }
  }, [])

  // Subscribe to messages and presence for selected thread
  useEffect(() => {
    cleanupChannel()
    if (!selectedThreadId || !selectedConversation) return

    const messagesChannel = supabase
      .channel(`dm-messages-${selectedThreadId}`, {
        config: {
          broadcast: { self: false },
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
          try {
            if (!payload || !payload.new) return
            
            const messageThreadId = (payload.new as { thread_id?: string })?.thread_id
            if (!messageThreadId || messageThreadId !== selectedThreadId) return

            const newMessage = payload.new as {
              id: string
              thread_id: string
              sender_id: string
              message_type: string
              content?: string | null
              metadata?: Record<string, unknown> | null
              has_attachments: boolean
              reply_to_message_id?: string | null
              created_at: string
              updated_at: string
              is_deleted: boolean
            }
            
            if (!newMessage || !newMessage.id) return

            if (newMessage.sender_id === viewerId) return

            setTypingIndicators((prev) => {
              const next = { ...prev }
              delete next[selectedThreadId]
              return next
            })
            if (typingDisplayTimeoutRef.current[selectedThreadId]) {
              clearTimeout(typingDisplayTimeoutRef.current[selectedThreadId])
              delete typingDisplayTimeoutRef.current[selectedThreadId]
            }
            setDisplayTypingIndicators((prev) => {
              const next = { ...prev }
              delete next[selectedThreadId]
              return next
            })

            const [attachmentsResult, readReceiptsResult, repliedToResult] = await Promise.all([
              supabase
                .from("dm_message_media")
                .select("id, message_id, media_type, storage_path, mime_type, file_size, duration_seconds, file_name, created_at, source_storage_path, source_bucket")
                .eq("message_id", newMessage.id),
              supabase
                .from("dm_message_reads")
                .select("id, message_id, user_id, read_at")
                .eq("message_id", newMessage.id),
              newMessage.reply_to_message_id
                ? Promise.all([
                    supabase
                      .from("dm_messages")
                      .select("id, sender_id, content, has_attachments, created_at, thread_id, is_deleted")
                      .eq("id", newMessage.reply_to_message_id)
                      .eq("thread_id", selectedThreadId)
                      .eq("is_deleted", false)
                      .maybeSingle(),
                    supabase
                      .from("dm_message_media")
                      .select("id, message_id, media_type, storage_path, mime_type, file_size, duration_seconds, file_name, created_at, source_storage_path, source_bucket")
                      .eq("message_id", newMessage.reply_to_message_id),
                  ]).then(([messageResult, attachmentsResult]) => ({
                    data: messageResult.data
                      ? {
                          ...messageResult.data,
                          attachments: attachmentsResult.data ?? [],
                        }
                      : null,
                    error: messageResult.error || attachmentsResult.error || null,
                  }))
                : Promise.resolve({ data: null, error: null }),
            ])

            if (newMessage.metadata?.boost_reward && attachmentsResult.data) {
              const needsCopying = attachmentsResult.data.some((a: any) => a.source_storage_path && a.source_bucket)
              if (needsCopying) {
                fetch("/api/dm/copy-boost-attachments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ messageId: newMessage.id }),
                }).catch((error) => {
                  console.error("Error copying boost reward attachments:", error)
                })
              }
            }

            const enrichedMessage: MessageResult = {
              id: newMessage.id,
              thread_id: newMessage.thread_id,
              sender_id: newMessage.sender_id,
              message_type: newMessage.message_type as "text" | "system",
              content: newMessage.content ?? null,
              metadata: newMessage.metadata ?? null,
              has_attachments: newMessage.has_attachments ?? false,
              reply_to_message_id: newMessage.reply_to_message_id ?? null,
              created_at: newMessage.created_at,
              updated_at: newMessage.updated_at,
              is_deleted: newMessage.is_deleted ?? false,
              attachments: attachmentsResult.data ?? [],
              read_receipts: readReceiptsResult.data ?? [],
              replied_to_message: repliedToResult.data &&
                repliedToResult.data.thread_id === selectedThreadId &&
                !repliedToResult.data.is_deleted
                ? {
                    id: repliedToResult.data.id,
                    sender_id: repliedToResult.data.sender_id,
                    content: repliedToResult.data.content ?? null,
                    has_attachments: repliedToResult.data.has_attachments ?? false,
                    created_at: repliedToResult.data.created_at,
                    attachments: (repliedToResult.data as any).attachments ?? [],
                  }
                : null,
            }

            setMessagesByThread((prev) => {
              const existingMessages = prev[selectedThreadId] ?? []
              if (existingMessages.some((message) => message.id === enrichedMessage.id)) {
                return prev
              }
              return {
                ...prev,
                [selectedThreadId]: [...existingMessages, enrichedMessage],
              }
            })

            const hasImage = enrichedMessage.attachments?.some(a => a.media_type === "image") ?? false
            setConversations((prev) =>
              prev
                .map((item) =>
                  item.thread_id === selectedThreadId
                    ? {
                        ...item,
                        last_message_at: enrichedMessage.created_at,
                        last_message_preview: enrichedMessage.content ?? (hasImage ? "[image]" : (enrichedMessage.attachments?.length ? "[attachment]" : "")),
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

            const currentThreadId = selectedThreadIdRef.current
            const currentMobileView = mobileViewRef.current
            const currentIsMobile = isMobileRef.current
            const isConversationActive = !currentIsMobile || currentMobileView === "conversation"
            if (currentThreadId === newMessage.thread_id && isConversationActive) {
              markMessagesAsRead(currentThreadId, [enrichedMessage.id]).catch((error) => {
                console.error("[realtime] Failed to mark message as read:", error)
              })
            }
          } catch (error) {
            console.error("[realtime] Error processing message INSERT event:", error, payload)
          }
        },
      )
      .subscribe()

    const channel = supabase
      .channel(getThreadChannelName(selectedThreadId), {
        config: {
          presence: {
            key: viewerId,
          },
        },
      })
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
        if (!userId || userId === viewerId) return
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
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_message_reads",
        },
        async (payload) => {
          try {
            const readReceipt = payload.new as {
              id: string
              message_id: string
              user_id: string
              read_at: string
            }
            if (!readReceipt || !readReceipt.message_id) return

            const currentThreadId = selectedThreadIdRef.current
            if (!currentThreadId) return

            const { data: messageData, error: messageError } = await supabase
              .from("dm_messages")
              .select("thread_id, sender_id")
              .eq("id", readReceipt.message_id)
              .single()

            if (messageError || !messageData) return

            const messageThreadId = messageData.thread_id
            if (messageThreadId !== currentThreadId) return

            if (messageData.sender_id !== viewerId) return

            setMessagesByThread((prev) => {
              const threadMessages = prev[currentThreadId] ?? []
              const messageExists = threadMessages.some((msg) => msg.id === readReceipt.message_id)
              
              if (!messageExists) return prev

              let updated = false
              const updatedMessages = threadMessages.map((msg) => {
                if (msg.id === readReceipt.message_id) {
                  const existingReceipt = msg.read_receipts?.find(
                    (r) => r.id === readReceipt.id || (r.message_id === readReceipt.message_id && r.user_id === readReceipt.user_id)
                  )
                  if (!existingReceipt) {
                    updated = true
                    return {
                      ...msg,
                      read_receipts: [...(msg.read_receipts ?? []), readReceipt],
                    }
                  }
                }
                return msg
              })

              if (!updated) return prev

              return {
                ...prev,
                [currentThreadId]: updatedMessages,
              }
            })
          } catch (error) {
            console.error("[realtime] Error processing read receipt INSERT event:", error, payload)
          }
        },
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          try {
            await channel.track({ userId: viewerId, at: Date.now() })
          } catch (error) {
            console.error("[channel.subscribe] Failed to track presence:", error)
          }
        }
      })

    channelRef.current = channel
    messagesChannelRef.current = messagesChannel

    return () => {
      cleanupChannel()
      if (messagesChannelRef.current) {
        try {
          supabase.removeChannel(messagesChannelRef.current)
        } catch (error) {
          console.error("[cleanupMessagesChannel] Error removing messages channel:", error)
        } finally {
          messagesChannelRef.current = null
        }
      }
    }
  }, [cleanupChannel, ensureAttachmentUrls, markMessagesAsRead, selectedConversation, selectedThreadId, viewerId, setMessagesByThread, setConversations, setTypingIndicators, setDisplayTypingIndicators, setPresenceMap, selectedThreadIdRef, mobileViewRef, isMobileRef, typingDisplayTimeoutRef])

  // Subscribe to thread updates
  useEffect(() => {
    cleanupThreadsChannel()

    const threadsChannel = supabase
      .channel("dm-threads-updates", {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "dm_threads",
        },
        async (payload) => {
          const updatedThread = payload.new as {
            id: string
            last_message_at: string | null
            last_message_preview: string | null
            last_message_sender_id: string | null
            updated_at: string
          }

          if (!updatedThread) return

          const existingConversation = conversationsRef.current.find(
            (c) => c.thread_id === updatedThread.id
          )

          if (!existingConversation) {
            refreshConversations().catch((error) => {
              console.error("[threadsChannel] Error refreshing conversations:", error)
            })
            return
          }

          setConversations((prev) =>
            prev
              .map((item) =>
                item.thread_id === updatedThread.id
                  ? {
                      ...item,
                      last_message_at: updatedThread.last_message_at,
                      last_message_preview: updatedThread.last_message_preview,
                      last_message_sender_id: updatedThread.last_message_sender_id,
                      updated_at: updatedThread.updated_at,
                    }
                  : item,
              )
              .sort((a, b) => {
                const aTime = new Date(a.last_message_at ?? a.updated_at).getTime()
                const bTime = new Date(b.last_message_at ?? b.updated_at).getTime()
                return bTime - aTime
              }),
          )
        },
      )
      .subscribe()

    threadsChannelRef.current = threadsChannel

    return () => {
      cleanupThreadsChannel()
    }
  }, [cleanupThreadsChannel, refreshConversations, conversationsRef, setConversations])

  return {
    channelRef,
    messagesChannelRef,
    threadsChannelRef,
  }
}

