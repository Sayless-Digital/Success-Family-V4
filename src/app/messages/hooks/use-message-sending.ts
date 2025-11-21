"use client"

import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import type { MessageResult } from "@/lib/chat-shared"
import type { AttachmentState, ThreadPaginationState } from "../types"
import type { ConversationListItem } from "@/lib/chat-shared"

interface UseMessageSendingOptions {
  viewerId: string
  selectedThreadId: string | null
  displayedConversations: ConversationListItem[]
  messagesByThread: Record<string, MessageResult[]>
  setMessagesByThread: React.Dispatch<React.SetStateAction<Record<string, MessageResult[]>>>
  setConversations: React.Dispatch<React.SetStateAction<ConversationListItem[]>>
  ensureAttachmentUrls: (attachments: MessageResult["attachments"]) => Promise<void>
  handleSelectConversation: (threadId: string) => Promise<void>
  refreshConversations: () => Promise<ConversationListItem[]>
  notifyTyping: (typing: boolean) => void
  typingDisplayTimeoutRef: React.MutableRefObject<Record<string, NodeJS.Timeout>>
  messageContainerRef: React.RefObject<HTMLDivElement | null>
  conversationsRef: React.MutableRefObject<ConversationListItem[]>
  initialThreadId: string | null
}

export function useMessageSending({
  viewerId,
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
}: UseMessageSendingOptions) {
  const [isSending, setIsSending] = useState(false)

  const handleSendMessage = useCallback(async (
    composerValue: string,
    attachments: AttachmentState[],
    replyingToMessage: MessageResult | null,
    resetComposer: () => void
  ) => {
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

    const optimisticMessageId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const now = new Date().toISOString()
    
    const optimisticMessage: MessageResult = {
      id: optimisticMessageId,
      thread_id: normalizedThreadId,
      sender_id: viewerId,
      message_type: "text",
      content: trimmed.length > 0 ? trimmed : null,
      metadata: null,
      has_attachments: readyAttachments.length > 0,
      reply_to_message_id: replyingToMessage?.id ?? null,
      created_at: now,
      updated_at: now,
      is_deleted: false,
      attachments: readyAttachments.map((attachment) => ({
        id: `temp-attachment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        message_id: optimisticMessageId,
        media_type: attachment.mediaType,
        storage_path: attachment.storagePath ?? "",
        mime_type: attachment.mimeType ?? null,
        file_size: attachment.fileSize ?? null,
        duration_seconds: attachment.durationSeconds ?? null,
        file_name: attachment.fileName ?? null,
        created_at: now,
      })),
      read_receipts: [],
      replied_to_message: replyingToMessage
        ? {
            id: replyingToMessage.id,
            sender_id: replyingToMessage.sender_id,
            content: replyingToMessage.content ?? null,
            has_attachments: replyingToMessage.has_attachments ?? false,
            created_at: replyingToMessage.created_at,
          }
        : null,
    }

    setMessagesByThread((prev) => ({
      ...prev,
      [normalizedThreadId]: [...(prev[normalizedThreadId] ?? []), optimisticMessage],
    }))
    
    const hasImage = optimisticMessage.attachments?.some(a => a.media_type === "image") ?? false
    setConversations((prev) =>
      prev
        .map((item) =>
          item.thread_id === normalizedThreadId
            ? {
                ...item,
                last_message_at: now,
                last_message_preview: optimisticMessage.content ?? (hasImage ? "[image]" : (optimisticMessage.attachments?.length ? "[attachment]" : "")),
                last_message_sender_id: viewerId,
                updated_at: now,
              }
            : item,
        )
        .sort((a, b) => {
          const aTime = new Date(a.last_message_at ?? a.updated_at).getTime()
          const bTime = new Date(b.last_message_at ?? b.updated_at).getTime()
          return bTime - aTime
        }),
    )

    ensureAttachmentUrls(optimisticMessage.attachments ?? [])
    resetComposer()
    
    if (messageContainerRef.current) {
      requestAnimationFrame(() => {
        const container = messageContainerRef.current
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      })
    }

    setIsSending(true)
    try {
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
            fileName: attachment.fileName,
          })),
          replyToMessageId: replyingToMessage?.id ?? null,
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
          read_receipts: [],
          replied_to_message: sentMessage.replied_to_message ?? null,
        }

        setMessagesByThread((prev) => {
          const existingMessages = prev[normalizedThreadId] ?? []
          const optimisticIndex = existingMessages.findIndex((msg) => msg.id === optimisticMessageId)
          
          if (optimisticIndex >= 0) {
            const updated = [...existingMessages]
            updated[optimisticIndex] = withAttachments
            return {
              ...prev,
              [normalizedThreadId]: updated,
            }
          } else {
            return {
              ...prev,
              [normalizedThreadId]: [...existingMessages, withAttachments],
            }
          }
        })
        
        const hasImageReal = withAttachments.attachments?.some(a => a.media_type === "image") ?? false
        setConversations((prev) =>
          prev
            .map((item) =>
              item.thread_id === normalizedThreadId
                ? {
                    ...item,
                    last_message_at: withAttachments.created_at,
                    last_message_preview: withAttachments.content ?? (hasImageReal ? "[image]" : (withAttachments.attachments?.length ? "[attachment]" : "")),
                    last_message_sender_id: viewerId,
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
      }
    } catch (error) {
      console.error(error)
      
      setMessagesByThread((prev) => {
        const existingMessages = prev[normalizedThreadId] ?? []
        const realMessages = existingMessages.filter((msg) => msg.id !== optimisticMessageId)
        const lastRealMessage = realMessages[realMessages.length - 1]
        
        if (lastRealMessage) {
          const hasImage = lastRealMessage.attachments?.some(a => a.media_type === "image") ?? false
          setConversations((convPrev) =>
            convPrev
              .map((item) =>
                item.thread_id === normalizedThreadId
                  ? {
                      ...item,
                      last_message_at: lastRealMessage.created_at,
                      last_message_preview: lastRealMessage.content ?? (hasImage ? "[image]" : (lastRealMessage.attachments?.length ? "[attachment]" : "")),
                      last_message_sender_id: lastRealMessage.sender_id,
                      updated_at: lastRealMessage.updated_at,
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
        
        return {
          ...prev,
          [normalizedThreadId]: realMessages,
        }
      })
      
      const fallback = "Could not send your message. Please try again."
      const message = error instanceof Error ? error.message || fallback : fallback
      toast.error(message)
    } finally {
      setIsSending(false)
      notifyTyping(false)
      if (selectedThreadId && typingDisplayTimeoutRef.current[selectedThreadId]) {
        clearTimeout(typingDisplayTimeoutRef.current[selectedThreadId])
        delete typingDisplayTimeoutRef.current[selectedThreadId]
      }
    }
  }, [
    selectedThreadId,
    isSending,
    viewerId,
    displayedConversations,
    ensureAttachmentUrls,
    handleSelectConversation,
    refreshConversations,
    notifyTyping,
    typingDisplayTimeoutRef,
    messageContainerRef,
    conversationsRef,
    initialThreadId,
    setMessagesByThread,
    setConversations,
  ])

  return {
    isSending,
    handleSendMessage,
  }
}

