"use client"

import { useMemo } from "react"
import Image from "next/image"
import { ChevronDown, Reply, Trash2, Video, FileText, ImageIcon, Download, Loader2 } from "lucide-react"
import { cn, linkifyText } from "@/lib/utils"
import { VoiceNotePlayer } from "@/components/voice-note-player"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { MessageResult, ConversationListItem } from "@/lib/chat-shared"
import type { ViewerProfile } from "../types"
import { getDisplayName, getInitials, formatTimestamp } from "../utils"
import { ReplyIndicator } from "./reply-indicator"

interface MessageItemProps {
  message: MessageResult
  viewer: ViewerProfile
  peerProfile: ConversationListItem["other_user_profile"] | null
  peerName: string
  peerInitials: string
  peerAvatar: string | null
  isOwn: boolean
  isDeleting: boolean
  isMobile: boolean
  highlightedMessageId: string | null
  longPressMenuOpen: string | null
  onLongPressMenuChange: (messageId: string | null) => void
  onReply: (message: MessageResult) => void
  onDelete: (messageId: string) => void
  onScrollToMessage: (messageId: string) => void
  attachmentUrls: Record<string, { url: string; expiresAt: number }>
  playingAudio: string | null
  playingVideo: string | null
  onAudioPlayStateChange: (attachmentId: string, isPlaying: boolean) => void
  onVideoPlayStateChange: (attachmentId: string | null) => void
  videoRefs: React.MutableRefObject<Record<string, HTMLVideoElement>>
  downloadingAttachmentId: string | null
  onDownloadAttachment: (attachmentId: string) => void
  swipeOffset?: number
  swipingMessageId?: string | null
  onTouchStart?: (e: React.TouchEvent) => void
  onTouchMove?: (e: React.TouchEvent) => void
  onTouchEnd?: (e: React.TouchEvent) => void
  onTouchCancel?: (e: React.TouchEvent) => void
  selectedConversation?: { other_user_id: string } | null
  messagesByThread?: Record<string, MessageResult[]>
  selectedThreadId?: string | null
  onImageClick?: (images: Array<{ id: string; url: string }>, index: number) => void
}

export function MessageItem({
  message,
  viewer,
  peerProfile,
  peerName,
  peerInitials,
  peerAvatar,
  isOwn,
  isDeleting,
  isMobile,
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
  swipeOffset = 0,
  swipingMessageId = null,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  selectedConversation,
  messagesByThread = {},
  selectedThreadId,
  onImageClick,
}: MessageItemProps) {
  const attachmentsForMessage = message.attachments ?? []
  const hasImages = attachmentsForMessage.some(a => a.media_type === "image")
  const hasVideos = attachmentsForMessage.some(a => a.media_type === "video")
  const hasAudio = attachmentsForMessage.some(a => a.media_type === "audio")
  const isImageOnly = hasImages && !message.content
  const isVideoOnly = hasVideos && !message.content && !hasImages
  const isAudioOnly = hasAudio && !message.content && !hasImages && !hasVideos

  const senderProfile = isOwn ? viewer : peerProfile
  const senderAvatar = isOwn ? viewer.profile_picture : peerAvatar
  const senderInitials = isOwn ? getInitials(viewer) : peerInitials
  const senderName = isOwn ? getDisplayName(viewer) : peerName
  const senderId = isOwn ? viewer.id : peerProfile?.id

  const readReceipts = message.read_receipts ?? []
  const otherUserId = selectedConversation?.other_user_id
  const isRead = isOwn && otherUserId 
    ? readReceipts.some((r) => r.user_id === otherUserId)
    : false
  const isSending = isOwn && message.id.startsWith('temp-')
  const isReadState = isOwn && isRead
  const isDelivered = isOwn && !isSending && !isReadState

  return (
    <div 
      className={cn("flex gap-1.5 sm:gap-2 group relative items-center", isOwn ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "rounded-2xl backdrop-blur-sm relative transition-all duration-500 z-10",
          highlightedMessageId === message.id && "ring-4 ring-white/70 shadow-2xl shadow-white/30 z-10",
          isAudioOnly 
            ? "w-[280px] sm:w-[320px]"
            : "max-w-[85%] sm:max-w-[70%] lg:max-w-[65%]",
          isImageOnly || isVideoOnly || isAudioOnly ? "p-0" : "px-2.5 sm:px-3 py-2 sm:py-2.5",
          isOwn
            ? "bg-gradient-to-br from-black/40 to-black/60 text-white"
            : "bg-gradient-to-br from-white/15 to-white/8 text-white",
          isDeleting && "opacity-50",
          isMobile && isOwn && !isDeleting && "select-none"
        )}
        style={{
          transform: swipeOffset > 0 ? `translate3d(${swipeOffset}px, 0, 0)` : undefined,
          transition: swipingMessageId === message.id ? 'none' : 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: swipingMessageId === message.id ? 'transform' : 'auto'
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
      >
        {isMobile && !isDeleting && swipeOffset > 0 && (
          <ReplyIndicator isOwn={isOwn} offset={swipeOffset} />
        )}
        
        {isOwn && !isDeleting && (
          <DropdownMenu open={isMobile ? longPressMenuOpen === message.id : undefined} onOpenChange={(open) => {
            if (isMobile && !open) {
              onLongPressMenuChange(null)
            }
          }}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-white/70 hover:text-white/90 focus:outline-none focus-visible:outline-none active:outline-none cursor-pointer p-2 z-40 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.03) 70%, transparent 100%)'
                }}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
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
                  onReply(message)
                }}
                className="text-white/80 hover:text-white hover:bg-white/10 cursor-pointer focus:text-white focus:bg-white/10"
              >
                <Reply className="h-3.5 w-3.5 mr-2" />
                Reply
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(message.id)
                }}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/20 cursor-pointer focus:text-red-300 focus:bg-red-500/20"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete message
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        {!isOwn && !isDeleting && (
          <DropdownMenu open={isMobile ? longPressMenuOpen === message.id : undefined} onOpenChange={(open) => {
            if (isMobile && !open) {
              onLongPressMenuChange(null)
            }
          }}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-white/70 hover:text-white/90 focus:outline-none focus-visible:outline-none active:outline-none cursor-pointer p-2 z-40 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.03) 70%, transparent 100%)'
                }}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
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
                  onReply(message)
                }}
                className="text-white/80 hover:text-white hover:bg-white/10 cursor-pointer focus:text-white focus:bg-white/10"
              >
                <Reply className="h-3.5 w-3.5 mr-2" />
                Reply
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        {message.replied_to_message?.id && (() => {
          const repliedMessageAttachments = message.replied_to_message.attachments ?? 
            (selectedThreadId ? (messagesByThread[selectedThreadId] ?? []) : [])
              .find(m => m.id === message.replied_to_message?.id)
              ?.attachments ?? []
          const imageAttachments = repliedMessageAttachments.filter(a => a.media_type === "image")
          const videoAttachments = repliedMessageAttachments.filter(a => a.media_type === "video")
          const documentAttachments = repliedMessageAttachments.filter(a => a.media_type === "file")
          const firstImage = imageAttachments[0]
          const firstVideo = videoAttachments[0]
          const firstDocument = documentAttachments[0]
          const hasImageOrVideo = firstImage || firstVideo
          const hasDocument = firstDocument && !hasImageOrVideo
          
          return (
            <div 
              className={cn(
                "mb-1.5 w-full py-1.5 px-2 rounded-lg border-l-2 flex items-start gap-2 cursor-pointer hover:opacity-80 transition-opacity",
                isOwn 
                  ? "bg-black/20 border-white/30" 
                  : "bg-white/5 border-white/20"
              )}
              onClick={(e) => {
                e.stopPropagation()
                if (message.replied_to_message?.id) {
                  onScrollToMessage(message.replied_to_message.id)
                }
              }}
            >
              {(hasImageOrVideo || hasDocument) && (
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg overflow-hidden border border-white/20 bg-black/20 flex-shrink-0 relative">
                  {firstImage && attachmentUrls[firstImage.id]?.url ? (
                    <Image
                      src={attachmentUrls[firstImage.id].url}
                      alt="Shared image"
                      width={40}
                      height={40}
                      className="h-full w-full object-cover"
                    />
                  ) : firstVideo && attachmentUrls[firstVideo.id]?.url ? (
                    <>
                      <video
                        src={attachmentUrls[firstVideo.id].url}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Video className="h-3 w-3 sm:h-4 sm:w-4 text-white/80" />
                      </div>
                    </>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-white/5">
                      {firstImage ? (
                        <ImageIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/50" />
                      ) : firstVideo ? (
                        <Video className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/50" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/50" />
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Reply className="h-3 w-3 text-white/50 flex-shrink-0" />
                  <span className="text-[10px] text-white/60 font-medium">
                    {message.replied_to_message.sender_id === viewer.id ? "You" : peerName}
                  </span>
                </div>
                {message.replied_to_message.content ? (
                  <p className="text-[10px] text-white/50 line-clamp-2 truncate">
                    {message.replied_to_message.content}
                  </p>
                ) : message.replied_to_message.has_attachments ? (
                  <p className="text-[10px] text-white/50 italic">
                    {firstImage ? "[image]" : firstVideo ? "[video]" : firstDocument ? (firstDocument.file_name || "[document]") : "[attachment]"}
                  </p>
                ) : (
                  <p className="text-[10px] text-white/50 italic">[message]</p>
                )}
              </div>
            </div>
          )
        })()}
        
        <div className={cn(isImageOnly || isVideoOnly ? "" : "space-y-1.5", !hasImages && !hasVideos && !isAudioOnly && "pr-12 sm:pr-14")}>
          {attachmentsForMessage.length > 0 && (
            <div className={cn(isImageOnly || isVideoOnly ? "" : "space-y-2", message.content && "mb-1.5")}>
              {attachmentsForMessage.map((attachment, attachmentIndex) => {
                const signedUrl = attachmentUrls[attachment.id]?.url
                
                if (attachment.media_type === "image") {
                  const imageAttachments = attachmentsForMessage.filter(a => a.media_type === "image")
                  const imageIndex = imageAttachments.findIndex(a => a.id === attachment.id)
                  
                  const handleImageClick = () => {
                    if (onImageClick) {
                      const images = imageAttachments.map(img => ({
                        id: img.id,
                        url: attachmentUrls[img.id]?.url || ""
                      })).filter(img => img.url)
                      
                      if (images.length > 0) {
                        onImageClick(images, imageIndex >= 0 ? imageIndex : 0)
                      }
                    }
                  }
                  
                  return (
                    <div 
                      key={`${message.id}-${attachment.id}-${attachmentIndex}`} 
                      className={cn(
                        "overflow-hidden border border-white/20 bg-black/20 relative flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity",
                        isImageOnly ? "rounded-2xl" : "rounded-lg"
                      )}
                      onClick={onImageClick ? handleImageClick : undefined}
                    >
                      {signedUrl ? (
                        <Image
                          src={signedUrl}
                          alt="Shared image"
                          width={640}
                          height={640}
                          className="w-full h-auto object-cover max-h-[200px] sm:max-h-[280px] block pointer-events-none"
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
                  if (!signedUrl) return null
                  
                  return (
                    <VoiceNotePlayer
                      key={`${message.id}-${attachment.id}-${attachmentIndex}`}
                      audioUrl={signedUrl}
                      attachmentId={attachment.id}
                      senderId={senderId}
                      senderAvatar={senderAvatar}
                      senderInitials={senderInitials}
                      senderName={senderName}
                      isPlaying={playingAudio === attachment.id}
                      onPlayStateChange={onAudioPlayStateChange}
                      onStopOthers={(currentId) => {
                        if (playingAudio && playingAudio !== currentId) {
                          onAudioPlayStateChange(playingAudio, false)
                        }
                      }}
                    />
                  )
                }
                
                if (attachment.media_type === "video") {
                  const isPlaying = playingVideo === attachment.id
                  
                  const handlePlayClick = async (e: React.MouseEvent) => {
                    e.stopPropagation()
                    const video = videoRefs.current[attachment.id]
                    if (!video) return
                    
                    try {
                      await video.play()
                      onVideoPlayStateChange(attachment.id)
                    } catch (error) {
                      console.error('Error playing video:', error)
                    }
                  }
                  
                  return (
                    <div
                      key={`${message.id}-${attachment.id}-${attachmentIndex}`}
                      className={cn(
                        "overflow-hidden border border-white/20 bg-black/20 relative flex-shrink-0 rounded-lg",
                        !isPlaying && "cursor-pointer",
                        isImageOnly || isVideoOnly ? "rounded-2xl" : "rounded-lg"
                      )}
                      onClick={!isPlaying ? handlePlayClick : undefined}
                    >
                      {signedUrl ? (
                        <div className="relative">
                          <video
                            ref={(el) => {
                              if (el && !videoRefs.current[attachment.id]) {
                                videoRefs.current[attachment.id] = el
                                const handlePlay = () => onVideoPlayStateChange(attachment.id)
                                const handlePause = () => {
                                  if (el.paused) {
                                    onVideoPlayStateChange(null)
                                  }
                                }
                                const handleEnded = () => onVideoPlayStateChange(null)
                                
                                el.addEventListener('play', handlePlay)
                                el.addEventListener('pause', handlePause)
                                el.addEventListener('ended', handleEnded)
                                
                                ;(el as any)._cleanup = () => {
                                  el.removeEventListener('play', handlePlay)
                                  el.removeEventListener('pause', handlePause)
                                  el.removeEventListener('ended', handleEnded)
                                }
                              }
                            }}
                            src={signedUrl}
                            className="w-full h-auto object-cover max-h-[200px] sm:max-h-[280px] block rounded-lg"
                            style={{ maxHeight: '280px' }}
                            controls={isPlaying}
                            controlsList="nodownload"
                            playsInline
                            preload="metadata"
                            onClick={(e) => {
                              if (isPlaying) {
                                e.stopPropagation()
                              }
                            }}
                          />
                          {!isPlaying && (
                            <div 
                              className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none z-10 rounded-lg"
                            >
                              <div className="bg-black/60 rounded-full p-3 backdrop-blur-sm">
                                <Video className="h-8 w-8 text-white/90 fill-white/90" />
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="h-32 flex items-center justify-center text-white/50 text-xs bg-white/5">
                          <Video className="h-8 w-8 text-white/50" />
                        </div>
                      )}
                    </div>
                  )
                }
                
                if (attachment.media_type === "file") {
                  const fileName = attachment.file_name ?? attachment.storage_path?.split('/').pop() ?? 'file'
                  
                  return (
                    <div
                      key={`${message.id}-${attachment.id}-${attachmentIndex}`}
                      className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white/75 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-white/70 flex-shrink-0" />
                        <span className="flex-1 truncate min-w-0" title={fileName}>
                          {fileName}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDownloadAttachment(attachment.id)
                          }}
                          disabled={downloadingAttachmentId === attachment.id}
                          className="flex-shrink-0 p-1 rounded hover:bg-white/10 text-white/70 hover:text-white/90 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          title={downloadingAttachmentId === attachment.id ? "Downloading..." : "Download file"}
                        >
                          {downloadingAttachmentId === attachment.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                        </button>
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
          
          {message.content && (
            <p className={cn(
              "text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words pr-12 sm:pr-14"
            )}>{linkifyText(message.content)}</p>
          )}
        </div>
        
        {(() => {
          const hasPlayingVideo = attachmentsForMessage.some(
            a => a.media_type === "video" && playingVideo === a.id
          )
          if (hasPlayingVideo) return null
          
          return (
            <div className={cn(
              "absolute flex items-center gap-1 text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5 rounded",
              isImageOnly || isVideoOnly
                ? "bottom-1.5 right-1.5 bg-black/60 text-white/90 backdrop-blur-sm"
                : isAudioOnly
                ? "bottom-2 right-2 sm:bottom-2.5 sm:right-2.5 text-white/40 px-1"
                : "bottom-1.5 right-1.5 text-white/40 px-1"
            )}>
              {formatTimestamp(message.created_at)}
              {isOwn && (
                <span className="flex-shrink-0 ml-1">
                  {isSending ? (
                    <span 
                      className="inline-block h-2 w-2 rounded-full bg-white border border-white/50 animate-pulse"
                      style={{
                        boxShadow: '0 0 6px rgba(255, 255, 255, 0.6), 0 0 12px rgba(255, 255, 255, 0.3)',
                      }}
                    />
                  ) : isReadState ? (
                    <span 
                      className="inline-block h-2 w-2 rounded-full"
                      style={{
                        background: 'linear-gradient(135deg, #10B981 0%, #3B82F6 50%, #06B6D4 100%)',
                        border: '1px solid rgba(16, 185, 129, 0.6)',
                        boxShadow: '0 0 6px rgba(16, 185, 129, 0.5), 0 0 12px rgba(59, 130, 246, 0.3)',
                      }}
                    />
                  ) : isDelivered ? (
                    <span 
                      className="inline-block h-2 w-2 rounded-full"
                      style={{
                        background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #9333EA 100%)',
                        border: '1px solid rgba(255, 215, 0, 0.6)',
                        boxShadow: '0 0 6px rgba(255, 215, 0, 0.5), 0 0 12px rgba(147, 51, 234, 0.3)',
                      }}
                    />
                  ) : (
                    <span 
                      className="inline-block h-2 w-2 rounded-full bg-white/40 border border-white/20"
                    />
                  )}
                </span>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}

