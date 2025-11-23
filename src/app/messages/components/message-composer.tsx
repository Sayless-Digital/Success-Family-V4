"use client"

import { useRef, useEffect } from "react"
import { Mic, Paperclip, Send, FileText, ImageIcon, Video, Loader2, X, Reply } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { VoiceNoteRecorder } from "@/components/voice-note-recorder"
import { EmojiPicker } from "@/components/emoji-picker"
import { cn, extractFirstUrl } from "@/lib/utils"
import { LinkPreviewCard } from "@/components/link-preview-card"
import { useLinkPreview } from "@/hooks/use-link-preview"
import { TiptapEditor } from "@/components/tiptap-editor"
import type { AttachmentState } from "../types"
import type { MessageResult } from "@/lib/chat-shared"

interface MessageComposerProps {
  composerValue: string
  onComposerChange: (value: string) => void
  attachments: AttachmentState[]
  onRemoveAttachment: (id: string) => void
  onSendMessage: () => void
  isSending: boolean
  composerDisabled: boolean
  replyingToMessage: MessageResult | null
  onCancelReply: () => void
  onScrollToMessage: (messageId: string) => void
  attachmentUrls: Record<string, { url: string; expiresAt: number }>
  peerName: string
  viewerId: string
  isVoiceRecorderOpen: boolean
  onVoiceRecorderOpen: (open: boolean) => void
  onVoiceNoteComplete: (blob: Blob) => Promise<void>
  onVoiceNoteCancel: () => void
  onAddFiles: (files: File[] | null, mediaType: AttachmentState["mediaType"]) => Promise<void>
  fileInputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>
  attachMenuOpen: boolean
  onAttachMenuOpenChange: (open: boolean) => void
  onEmojiSelect: (emoji: string) => void
  isMobile: boolean
}

export function MessageComposer({
  composerValue,
  onComposerChange,
  attachments,
  onRemoveAttachment,
  onSendMessage,
  isSending,
  composerDisabled,
  replyingToMessage,
  onCancelReply,
  onScrollToMessage,
  attachmentUrls,
  peerName,
  viewerId,
  isVoiceRecorderOpen,
  onVoiceRecorderOpen,
  onVoiceNoteComplete,
  onVoiceNoteCancel,
  onAddFiles,
  fileInputRefs,
  attachMenuOpen,
  onAttachMenuOpenChange,
  onEmojiSelect,
  isMobile,
}: MessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  
  // Extract URL from content for real-time preview
  const detectedUrl = extractFirstUrl(composerValue)
  const { preview, loading } = useLinkPreview(detectedUrl, {
    enabled: !!detectedUrl && !isVoiceRecorderOpen,
    debounceMs: 500,
  })

  const autoResizeTextarea = () => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = "auto"
    const scrollHeight = textarea.scrollHeight
    const isSmallScreen = typeof window !== "undefined" && window.innerWidth < 640
    const maxHeight = isSmallScreen ? 96 : 128
    const minHeight = 32
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
    textarea.style.height = `${newHeight}px`
  }

  useEffect(() => {
    autoResizeTextarea()
  }, [composerValue])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.keyCode === 13) {
      if (!isMobile) {
        if (event.shiftKey) {
          // Shift+Enter: allow default (new line)
          return false
        } else {
          // Enter: send message
          event.preventDefault()
          event.stopPropagation()
          if (!isSending && !composerDisabled) {
            onSendMessage()
          }
          return false
        }
      } else {
        // MOBILE: Enter creates new line, Shift+Enter sends
        if (event.shiftKey) {
          event.preventDefault()
          event.stopPropagation()
          onSendMessage()
          return false
        }
        // Enter: allow default (new line)
        return false
      }
    }
    return true
  }

  return (
    <div className="p-2 sm:p-3 space-y-2">
      {composerDisabled && (
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
              {attachment.mediaType === "image" && attachment.previewUrl ? (
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg overflow-hidden border border-white/20 bg-black/20 flex-shrink-0">
                  <Image
                    src={attachment.previewUrl}
                    alt={attachment.fileName}
                    width={48}
                    height={48}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : attachment.mediaType === "video" && attachment.previewUrl ? (
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg overflow-hidden border border-white/20 bg-black/20 flex-shrink-0 relative">
                  <video
                    src={attachment.previewUrl}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Video className="h-4 w-4 text-white/80" />
                  </div>
                </div>
              ) : (
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg border border-white/20 bg-white/5 flex items-center justify-center flex-shrink-0">
                  {attachment.mediaType === "audio" && (
                    <Mic className="h-4 w-4 text-white/70" />
                  )}
                  {attachment.mediaType === "video" && (
                    <Video className="h-4 w-4 text-white/70" />
                  )}
                  {attachment.mediaType === "file" && (
                    <FileText className="h-4 w-4 text-white/70" />
                  )}
                  {attachment.mediaType === "image" && (
                    <ImageIcon className="h-4 w-4 text-white/70" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="max-w-[160px] truncate" title={attachment.fileName}>
                  {attachment.fileName}
                </div>
              </div>
              {attachment.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-white/60 flex-shrink-0" />}
              {attachment.status === "error" && <span className="text-rose-200 text-[10px] flex-shrink-0">Upload failed</span>}
              {attachment.mediaType === "file" && attachment.status === "ready" && attachment.storagePath && (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation()
                    try {
                      if (attachment.previewUrl) {
                        const link = document.createElement('a')
                        link.href = attachment.previewUrl
                        link.download = attachment.fileName
                        link.style.display = 'none'
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                      }
                    } catch (error) {
                      console.error("Download error:", error)
                    }
                  }}
                  className="flex-shrink-0 p-1 rounded hover:bg-white/10 text-white/70 hover:text-white/90 transition"
                  title="Download file"
                >
                  <FileText className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemoveAttachment(attachment.id)}
                className="ml-1 rounded-full bg-white/10 hover:bg-white/20 p-1 text-white/60 hover:text-white/90 transition flex-shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {isVoiceRecorderOpen && (
        <VoiceNoteRecorder
          onRecordingComplete={onVoiceNoteComplete}
          onCancel={onVoiceNoteCancel}
          maxDurationMinutes={5}
          autoStart={true}
        />
      )}
      
      {/* Real-time Link Preview */}
      {detectedUrl && !isVoiceRecorderOpen && (
        <LinkPreviewCard
          preview={preview}
          loading={loading}
          compact={true}
        />
      )}

      {replyingToMessage && (
        <div className="w-full mb-2">
          <div
            className="py-2.5 sm:py-3 px-3 sm:px-4 bg-white/5 border-l-2 border-white/30 rounded-lg flex items-start gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              if (replyingToMessage.id) {
                onScrollToMessage(replyingToMessage.id)
              }
            }}
          >
            {(() => {
              const imageAttachments = replyingToMessage.attachments?.filter(a => a.media_type === "image") ?? []
              const videoAttachments = replyingToMessage.attachments?.filter(a => a.media_type === "video") ?? []
              const documentAttachments = replyingToMessage.attachments?.filter(a => a.media_type === "file") ?? []
              const firstImage = imageAttachments[0]
              const firstVideo = videoAttachments[0]
              const firstDocument = documentAttachments[0]
              const hasImageOrVideo = firstImage || firstVideo
              const hasDocument = firstDocument && !hasImageOrVideo

              return (
                <>
                  {(hasImageOrVideo || hasDocument) && (
                    <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-lg overflow-hidden border border-white/20 bg-black/20 flex-shrink-0 relative">
                      {firstImage && attachmentUrls[firstImage.id]?.url ? (
                        <Image
                          src={attachmentUrls[firstImage.id].url}
                          alt="Shared image"
                          width={64}
                          height={64}
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
                            <Video className="h-4 w-4 sm:h-5 sm:w-5 text-white/80" />
                          </div>
                        </>
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-white/5">
                          {firstImage ? (
                            <ImageIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white/50" />
                          ) : firstVideo ? (
                            <Video className="h-5 w-5 sm:h-6 sm:w-6 text-white/50" />
                          ) : (
                            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white/50" />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Reply className="h-3 w-3 text-white/50 flex-shrink-0" />
                      <span className="text-[10px] text-white/60 font-medium">
                        Replying to {replyingToMessage.sender_id === viewerId ? "yourself" : peerName}
                      </span>
                    </div>
                    {replyingToMessage.content ? (
                      <p className="text-[10px] text-white/50 line-clamp-2 truncate">
                        {replyingToMessage.content}
                      </p>
                    ) : replyingToMessage.has_attachments ? (
                      <p className="text-[10px] text-white/50 italic">
                        {firstImage ? "[image]" : firstVideo ? "[video]" : firstDocument ? (firstDocument.file_name || "[document]") : "[attachment]"}
                      </p>
                    ) : (
                      <p className="text-[10px] text-white/50 italic">[message]</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 rounded-full text-white/50 hover:text-white hover:bg-white/10 flex-shrink-0"
                    onClick={() => onCancelReply()}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              )
            })()}
          </div>
        </div>
      )}

      <div
        className={cn(
          "flex items-end gap-2 sm:gap-3 bg-white/10 border border-white/20 rounded-2xl px-2 sm:px-3 py-1.5 sm:py-2",
          composerDisabled && "opacity-60 pointer-events-none",
        )}
      >
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <DropdownMenu open={attachMenuOpen} onOpenChange={onAttachMenuOpenChange}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="group relative flex items-center justify-center h-8 w-8 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30 flex-shrink-0"
                title="Attach file"
              >
                <Paperclip className="h-4 w-4 text-white/70 group-hover:text-white/80 transition-all" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="top"
              sideOffset={8}
              className="bg-white/10 border border-white/20 backdrop-blur-xl"
            >
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  fileInputRefs.current.image?.click()
                }}
                className="cursor-pointer"
              >
                <ImageIcon className="h-4 w-4 text-white/70 mr-2" />
                <span className="text-white/90">Image</span>
              </DropdownMenuItem>
              <input
                ref={(el) => { fileInputRefs.current.image = el }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const files = event.target.files ? Array.from(event.target.files) : null
                  if (files && files.length > 0) {
                    onAddFiles(files, "image")
                  }
                  onAttachMenuOpenChange(false)
                  event.target.value = ""
                }}
                multiple
              />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  fileInputRefs.current.video?.click()
                }}
                className="cursor-pointer"
              >
                <Video className="h-4 w-4 text-white/70 mr-2" />
                <span className="text-white/90">Video</span>
              </DropdownMenuItem>
              <input
                ref={(el) => { fileInputRefs.current.video = el }}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={async (event) => {
                  const files = event.target.files ? Array.from(event.target.files) : null
                  if (files && files.length > 0) {
                    try {
                      await onAddFiles(files, "video")
                    } catch (error) {
                      console.error('Error in handleAddFiles for video:', error)
                    }
                  }
                  onAttachMenuOpenChange(false)
                  event.target.value = ""
                }}
                multiple
              />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  fileInputRefs.current.audio?.click()
                }}
                className="cursor-pointer"
              >
                <Mic className="h-4 w-4 text-white/70 mr-2" />
                <span className="text-white/90">Audio File</span>
              </DropdownMenuItem>
              <input
                ref={(el) => { fileInputRefs.current.audio = el }}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(event) => {
                  const files = event.target.files ? Array.from(event.target.files) : null
                  if (files && files.length > 0) {
                    onAddFiles(files, "audio")
                  }
                  onAttachMenuOpenChange(false)
                  event.target.value = ""
                }}
                multiple
              />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  fileInputRefs.current.document?.click()
                }}
                className="cursor-pointer"
              >
                <FileText className="h-4 w-4 text-white/70 mr-2" />
                <span className="text-white/90">Document</span>
              </DropdownMenuItem>
              <input
                ref={(el) => { fileInputRefs.current.document = el }}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,application/rtf"
                className="hidden"
                onChange={(event) => {
                  const files = event.target.files ? Array.from(event.target.files) : null
                  if (files && files.length > 0) {
                    onAddFiles(files, "file")
                  }
                  onAttachMenuOpenChange(false)
                  event.target.value = ""
                }}
                multiple
              />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  onVoiceRecorderOpen(true)
                  onAttachMenuOpenChange(false)
                }}
                className="cursor-pointer"
                disabled={isVoiceRecorderOpen}
              >
                <Mic className="h-4 w-4 text-white/70 mr-2" />
                <span className="text-white/90">Voice Note</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <EmojiPicker
            onEmojiSelect={onEmojiSelect}
            disabled={isSending || isVoiceRecorderOpen || composerDisabled}
          />
        </div>
        <div className="flex-1 min-w-0">
          <TiptapEditor
          value={composerValue}
            onChange={onComposerChange}
          placeholder={
            composerDisabled
              ? "Cannot send messages"
              : replyingToMessage
                ? "Type your reply..."
                : "Type a message"
          }
            disabled={composerDisabled}
            minHeight={32}
            maxHeight={isMobile ? 96 : 128}
          onKeyDown={handleKeyDown}
            size="sm"
            className="text-sm sm:text-[15px] leading-[1.4]"
        />
        </div>
        <Button
          type="button"
          disabled={isSending || composerDisabled}
          onClick={onSendMessage}
          className="group relative flex items-center justify-center h-8 w-8 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30 flex-shrink-0"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin text-white/70 group-hover:text-white/80 transition-all" />
          ) : (
            <Send className="h-4 w-4 text-white/70 group-hover:text-white/80 transition-all" />
          )}
        </Button>
      </div>
    </div>
  )
}


