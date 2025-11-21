"use client"

import { useRef, useEffect } from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MessageImageLightbox } from "@/components/message-image-lightbox"
import { cn } from "@/lib/utils"
import type { MessageResult } from "@/lib/chat-shared"
import { MessageItem } from "./message-item"
import type { ViewerProfile } from "../types"
import type { ConversationListItem } from "@/lib/chat-shared"

interface MessageListProps {
  messages: MessageResult[]
  viewer: ViewerProfile
  peerProfile: ConversationListItem["other_user_profile"] | null
  peerName: string
  peerInitials: string
  peerAvatar: string | null
  isMobile: boolean
  highlightedMessageId: string | null
  longPressMenuOpen: string | null
  onLongPressMenuChange: (messageId: string | null) => void
  onReply: (message: MessageResult) => void
  onDelete: (messageId: string) => void
  onScrollToMessage: (messageId: string) => Promise<void>
  attachmentUrls: Record<string, { url: string; expiresAt: number }>
  playingAudio: string | null
  playingVideo: string | null
  onAudioPlayStateChange: (attachmentId: string, isPlaying: boolean) => void
  onVideoPlayStateChange: (attachmentId: string | null) => void
  videoRefs: React.MutableRefObject<Record<string, HTMLVideoElement>>
  downloadingAttachmentId: string | null
  onDownloadAttachment: (attachmentId: string) => void
  swipeOffset: Record<string, number>
  swipingMessageId: string | null
  onSwipeStart: (messageId: string, e: React.TouchEvent) => void
  onSwipeMove: (e: React.TouchEvent) => void
  onSwipeEnd: (messageId: string, onReply: (messageId: string) => void) => void
  hasMore: boolean
  loadingOlderMessages: boolean
  onLoadOlderMessages: () => void
  selectedConversation: ConversationListItem | null
  messagesByThread: Record<string, MessageResult[]>
  selectedThreadId: string | null
  lightboxOpen: boolean
  lightboxImages: Array<{ id: string; url: string }>
  lightboxIndex: number
  onLightboxOpenChange: (open: boolean) => void
  onImageClick: (images: Array<{ id: string; url: string }>, index: number) => void
  deletingMessageId: string | null
}

export function MessageList({
  messages,
  viewer,
  peerProfile,
  peerName,
  peerInitials,
  peerAvatar,
  isMobile,
  deletingMessageId,
  highlightedMessageId,
  longPressMenuOpen,
  onLongPressMenuChange,
  onReply,
  onDelete,
  onScrollToMessage,
  attachmentUrls,
  playingAudio,
  playingVideo,
  onAudioPlayStateChange,
  onVideoPlayStateChange,
  videoRefs,
  downloadingAttachmentId,
  onDownloadAttachment,
  swipeOffset,
  swipingMessageId,
  onSwipeStart,
  onSwipeMove,
  onSwipeEnd,
  hasMore,
  loadingOlderMessages,
  onLoadOlderMessages,
  selectedConversation,
  messagesByThread,
  selectedThreadId,
  lightboxOpen,
  lightboxImages,
  lightboxIndex,
  onLightboxOpenChange,
  onImageClick,
}: MessageListProps) {
  const messageContainerRef = useRef<HTMLDivElement | null>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Scroll to bottom when messages change
  useEffect(() => {
    const container = messageContainerRef.current
    if (!container) return
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
    if (isNearBottom) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight
      })
    }
  }, [messages.length])

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <div ref={messageContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-2 sm:px-4 py-3 sm:py-4 space-y-2">
          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white/90 hover:bg-white/10 border border-white/20"
                onClick={onLoadOlderMessages}
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

          {messages.map((message) => {
            const isOwn = message.sender_id === viewer.id
            const isDeletingMessage = deletingMessageId === message.id

            return (
              <div 
                key={message.id} 
                ref={(el) => {
                  if (el) {
                    messageRefs.current.set(message.id, el)
                  } else {
                    messageRefs.current.delete(message.id)
                  }
                }}
              >
                <MessageItem
                  message={message}
                  viewer={viewer}
                  peerProfile={peerProfile}
                  peerName={peerName}
                  peerInitials={peerInitials}
                  peerAvatar={peerAvatar}
                  isOwn={isOwn}
                  isDeleting={isDeletingMessage || false}
                  isMobile={isMobile}
                  highlightedMessageId={highlightedMessageId}
                  longPressMenuOpen={longPressMenuOpen}
                  onLongPressMenuChange={onLongPressMenuChange}
                  onReply={onReply}
                  onDelete={onDelete}
                  onScrollToMessage={onScrollToMessage}
                  attachmentUrls={attachmentUrls}
                  playingAudio={playingAudio}
                  playingVideo={playingVideo}
                  onAudioPlayStateChange={onAudioPlayStateChange}
                  onVideoPlayStateChange={onVideoPlayStateChange}
                  videoRefs={videoRefs}
                  downloadingAttachmentId={downloadingAttachmentId}
                  onDownloadAttachment={onDownloadAttachment}
                  swipeOffset={swipeOffset[message.id] || 0}
                  swipingMessageId={swipingMessageId}
                  onImageClick={onImageClick}
                  onTouchStart={(e) => {
                    if (!isDeletingMessage && isMobile) {
                      onSwipeStart(message.id, e)
                    }
                  }}
                  onTouchMove={(e) => {
                    if (!isDeletingMessage && isMobile) {
                      onSwipeMove(e)
                    }
                  }}
                  onTouchEnd={(e) => {
                    if (!isDeletingMessage && isMobile) {
                      onSwipeEnd(message.id, (messageId) => {
                        const msg = messages.find(m => m.id === messageId)
                        if (msg) onReply(msg)
                      })
                    }
                  }}
                  onTouchCancel={(e) => {
                    if (!isDeletingMessage && isMobile) {
                      onSwipeEnd(message.id, () => {})
                    }
                  }}
                  selectedConversation={selectedConversation}
                  messagesByThread={messagesByThread}
                  selectedThreadId={selectedThreadId}
                />
              </div>
            )
          })}
        </div>
      </div>
      
      <MessageImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={onLightboxOpenChange}
      />
    </div>
  )
}

