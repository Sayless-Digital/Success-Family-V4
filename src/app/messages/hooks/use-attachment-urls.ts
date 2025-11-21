"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { storagePathToObjectPath } from "../utils"
import type { MessageResult } from "@/lib/chat-shared"

const SIGNED_URL_TTL_SECONDS = 60 * 15 // 15 minutes
const SIGNED_URL_REFRESH_THRESHOLD = 60 * 10 // Refresh after 10 minutes

interface UseAttachmentUrlsOptions {
  selectedMessages?: MessageResult[]
  replyingToMessage?: MessageResult | null
  messagesByThread?: Record<string, MessageResult[]>
  selectedThreadId?: string | null
}

export function useAttachmentUrls(options?: UseAttachmentUrlsOptions) {
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, { url: string; expiresAt: number }>>({})

  const ensureAttachmentUrls = useCallback(
    async (attachmentsToEnsure: MessageResult["attachments"], forceRefresh = false) => {
      if (!attachmentsToEnsure || attachmentsToEnsure.length === 0) return

      const now = Date.now()

      await Promise.all(
        attachmentsToEnsure.map(async (attachment: any) => {
          const existing = attachmentUrls[attachment.id]
          
          // Skip if URL exists and hasn't expired (unless force refresh)
          if (!forceRefresh && existing && existing.expiresAt > now + SIGNED_URL_REFRESH_THRESHOLD * 1000) {
            return
          }

          // If attachment has source_storage_path, it needs to be copied first
          if (attachment.source_storage_path && attachment.source_bucket) {
            // Find the message ID to copy the file
            const messageId = attachment.message_id
            if (messageId) {
              try {
                await fetch("/api/dm/copy-boost-attachments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ messageId }),
                })
                // Wait a bit for the copy to complete
                await new Promise(resolve => setTimeout(resolve, 500))
                // Re-fetch the attachment to get updated storage_path
                const { data: updatedAttachment } = await supabase
                  .from("dm_message_media")
                  .select("storage_path")
                  .eq("id", attachment.id)
                  .single()
                if (updatedAttachment) {
                  attachment.storage_path = updatedAttachment.storage_path
                }
              } catch (error) {
                console.error("Error copying boost reward attachment:", error)
                return
              }
            }
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

  // Auto-ensure URLs for selected messages
  useEffect(() => {
    if (!options?.selectedMessages?.length) return
    ensureAttachmentUrls(options.selectedMessages.flatMap((message) => message.attachments ?? []))
  }, [options?.selectedMessages, ensureAttachmentUrls])

  // Ensure attachment URLs for replying to message
  useEffect(() => {
    if (!options?.replyingToMessage?.attachments?.length) return
    ensureAttachmentUrls(options.replyingToMessage.attachments)
  }, [options?.replyingToMessage?.attachments, ensureAttachmentUrls])

  // Ensure attachment URLs for replied messages in current thread
  useEffect(() => {
    if (!options?.selectedThreadId || !options?.messagesByThread) return
    const threadMessages = options.messagesByThread[options.selectedThreadId] ?? []
    const repliedAttachments: MessageResult["attachments"] = []
    threadMessages.forEach(message => {
      if (message.replied_to_message?.attachments) {
        repliedAttachments.push(...message.replied_to_message.attachments)
      }
    })
    
    if (repliedAttachments.length > 0) {
      ensureAttachmentUrls(repliedAttachments)
    }
  }, [options?.selectedThreadId, options?.messagesByThread, ensureAttachmentUrls])

  return {
    attachmentUrls,
    ensureAttachmentUrls,
  }
}

