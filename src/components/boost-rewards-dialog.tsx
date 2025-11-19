"use client"

import * as React from "react"
import { Crown, Image as ImageIcon, FileText, X, Paperclip } from "lucide-react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmojiPicker } from "@/components/emoji-picker"
import { cn } from "@/lib/utils"

interface BoostRewardAttachment {
  file: File
  preview: string
  type: 'image' | 'document'
}

interface BoostRewardsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requiresBoost?: boolean
  onRequiresBoostChange?: (requiresBoost: boolean) => void
  boostRewardMessage?: string | null
  onBoostRewardMessageChange?: (message: string) => void
  boostRewardAttachments?: BoostRewardAttachment[]
  onBoostRewardAttachmentsChange?: (attachments: BoostRewardAttachment[]) => void
  mediaType?: "audio" | "image" | "video" | "document"
  hasVoiceNote?: boolean
}

export function BoostRewardsDialog({
  open,
  onOpenChange,
  requiresBoost,
  onRequiresBoostChange,
  boostRewardMessage,
  onBoostRewardMessageChange,
  boostRewardAttachments = [],
  onBoostRewardAttachmentsChange,
  mediaType = "audio",
  hasVoiceNote = false,
}: BoostRewardsDialogProps) {
  const [messageEnabled, setMessageEnabled] = React.useState((boostRewardMessage?.length || 0) > 0 || boostRewardAttachments.length > 0)
  const [attachMenuOpen, setAttachMenuOpen] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    setMessageEnabled((boostRewardMessage?.length || 0) > 0 || boostRewardAttachments.length > 0)
  }, [boostRewardMessage, boostRewardAttachments])

  const handleCheckedChange = (checked: boolean) => {
    onRequiresBoostChange?.(checked)
  }

  const handleMessageEnabledChange = (checked: boolean) => {
    setMessageEnabled(checked)
    if (!checked) {
      onBoostRewardMessageChange?.("")
      onBoostRewardAttachmentsChange?.([])
    }
  }

  // Auto-resize textarea based on content
  const autoResizeTextarea = React.useCallback(() => {
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

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onBoostRewardMessageChange?.(e.target.value)
    // Auto-resize textarea after state update
    setTimeout(() => {
      autoResizeTextarea()
    }, 0)
  }

  const handleEmojiSelect = React.useCallback((emoji: string) => {
    if (!textareaRef.current) return
    
    const textarea = textareaRef.current
    // Focus the textarea first to ensure selection is valid
    textarea.focus()
    
    // Get cursor position (default to end if no selection)
    const currentValue = boostRewardMessage || ""
    const start = textarea.selectionStart ?? currentValue.length
    const end = textarea.selectionEnd ?? currentValue.length
    const textBefore = currentValue.substring(0, start)
    const textAfter = currentValue.substring(end)
    
    const newValue = textBefore + emoji + textAfter
    onBoostRewardMessageChange?.(newValue)
    
    // Set cursor position after the inserted emoji
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPosition = start + emoji.length
        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition)
        textareaRef.current.focus()
        // Auto-resize after emoji insertion
        autoResizeTextarea()
      }
    }, 0)
  }, [boostRewardMessage, onBoostRewardMessageChange, autoResizeTextarea])

  // Auto-resize on mount and when message changes
  React.useEffect(() => {
    if (messageEnabled) {
      setTimeout(() => {
        autoResizeTextarea()
      }, 0)
    }
  }, [messageEnabled, boostRewardMessage, autoResizeTextarea])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    files.forEach(file => {
      const isImage = file.type.startsWith('image/')
      const isDocument = !isImage && (
        file.type.startsWith('application/') ||
        file.type.startsWith('text/') ||
        file.name.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv)$/i)
      )

      if (!isImage && !isDocument) {
        return
      }

      // Create preview URL
      const preview = URL.createObjectURL(file)
      const type = isImage ? 'image' as const : 'document' as const
      
      onBoostRewardAttachmentsChange?.([...boostRewardAttachments, { file, preview, type }])
    })

    // Close dropdown and reset input
    setAttachMenuOpen(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.accept = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
    }
  }

  const removeAttachment = (index: number) => {
    const updated = [...boostRewardAttachments]
    URL.revokeObjectURL(updated[index].preview)
    updated.splice(index, 1)
    onBoostRewardAttachmentsChange?.(updated)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Crown className="h-5 w-5 text-white/80" />
            <DialogTitle>Boost Rewards</DialogTitle>
          </div>
          <DialogDescription className="text-white/70 text-center">
            Reward users who boost your post with exclusive content or automated messages.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 mt-6">
          {mediaType === "audio" && onRequiresBoostChange !== undefined && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                if (!hasVoiceNote) return
                handleCheckedChange(!requiresBoost)
              }}
              disabled={!hasVoiceNote}
              className={cn(
                "w-full flex items-center gap-3 p-4 rounded-lg border transition-colors text-left",
                hasVoiceNote
                  ? "bg-white/5 border-white/10 hover:bg-white/10 active:bg-white/15 cursor-pointer"
                  : "bg-white/5 border-white/10 opacity-60 cursor-not-allowed"
              )}
            >
              <div 
                className={cn(
                  "flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors relative overflow-hidden",
                  hasVoiceNote && requiresBoost
                    ? "border-yellow-400/50"
                    : hasVoiceNote
                      ? "bg-transparent border-white/30"
                      : "bg-transparent border-white/20"
                )}
                style={hasVoiceNote && requiresBoost ? {
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #9333EA 100%)',
                  boxShadow: '0 0 10px rgba(255, 215, 0, 0.5), 0 0 20px rgba(147, 51, 234, 0.3)',
                } : undefined}
              >
                {hasVoiceNote && requiresBoost && (
                  <svg className="h-3 w-3 text-white relative z-10 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn(
                  "text-sm font-medium leading-tight",
                  hasVoiceNote ? "text-white/90" : "text-white/60"
                )}>
                  {hasVoiceNote ? "Lock voice note behind boost" : "Add voice note to enable"}
                </div>
              </div>
            </button>
          )}
          
          {/* Automated Message Reward */}
          {onBoostRewardMessageChange !== undefined && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  handleMessageEnabledChange(!messageEnabled)
                }}
                className="w-full flex items-center gap-3 p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 active:bg-white/15 transition-colors text-left cursor-pointer"
              >
                <div 
                  className={cn(
                    "flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors relative overflow-hidden",
                    messageEnabled
                      ? "border-yellow-400/50"
                      : "bg-transparent border-white/30"
                  )}
                  style={messageEnabled ? {
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #9333EA 100%)',
                    boxShadow: '0 0 10px rgba(255, 215, 0, 0.5), 0 0 20px rgba(147, 51, 234, 0.3)',
                  } : undefined}
                >
                  {messageEnabled && (
                    <svg className="h-3 w-3 text-white relative z-10 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white/90 leading-tight">
                    Send automated message to boosters
                  </div>
                  <p className="text-xs text-white/60 mt-1">
                    Costs 1 point to add
                  </p>
                </div>
              </button>
              {messageEnabled && (
                <div className="space-y-3">
                  {/* File Attachments - shown above textarea like message composer */}
                  {onBoostRewardAttachmentsChange && boostRewardAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {boostRewardAttachments.map((attachment, index) => (
                        <div
                          key={index}
                          className={cn(
                            "relative rounded-xl border px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center gap-2 text-xs",
                            "border-white/20 text-white/75 bg-white/10"
                          )}
                        >
                          {attachment.type === 'image' && attachment.preview ? (
                            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg overflow-hidden border border-white/20 bg-black/20 flex-shrink-0">
                              <Image
                                src={attachment.preview}
                                alt={attachment.file.name}
                                width={48}
                                height={48}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg border border-white/20 bg-white/5 flex items-center justify-center flex-shrink-0">
                              <FileText className="h-4 w-4 text-white/70" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="max-w-[160px] truncate" title={attachment.file.name}>
                              {attachment.file.name}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="ml-1 rounded-full bg-white/10 hover:bg-white/20 p-1 text-white/60 hover:text-white/90 transition flex-shrink-0"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Composer area with textarea and attach button */}
                  <div className="flex items-end gap-2 sm:gap-3 bg-white/10 border border-white/20 rounded-2xl px-2 sm:px-3 py-1.5 sm:py-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      {onBoostRewardAttachmentsChange && (
                        <DropdownMenu open={attachMenuOpen} onOpenChange={setAttachMenuOpen}>
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
                                setAttachMenuOpen(false)
                                const input = fileInputRef.current
                                if (input) {
                                  input.accept = "image/*"
                                  // Small delay to allow dropdown to close first
                                  setTimeout(() => {
                                    input.click()
                                  }, 100)
                                }
                              }}
                              className="cursor-pointer"
                            >
                              <ImageIcon className="h-4 w-4 text-white/70 mr-2" />
                              <span className="text-white/90">Image</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault()
                                setAttachMenuOpen(false)
                                const input = fileInputRef.current
                                if (input) {
                                  input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
                                  // Small delay to allow dropdown to close first
                                  setTimeout(() => {
                                    input.click()
                                  }, 100)
                                }
                              }}
                              className="cursor-pointer"
                            >
                              <FileText className="h-4 w-4 text-white/70 mr-2" />
                              <span className="text-white/90">Document</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <EmojiPicker
                        onEmojiSelect={handleEmojiSelect}
                        disabled={false}
                      />
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <textarea
                      ref={textareaRef}
                      id="boost-reward-message"
                      placeholder="Write something man"
                      value={boostRewardMessage || ""}
                      onChange={handleMessageChange}
                      className="flex-1 bg-transparent border-0 resize-none outline-none text-sm sm:text-[15px] text-white/80 placeholder:text-white/40 max-h-24 sm:max-h-32 min-h-[32px] leading-[1.4] overflow-y-auto pt-1.5 pb-0.5 sm:pt-2 sm:pb-1.5 placeholder:whitespace-nowrap placeholder:overflow-hidden placeholder:text-ellipsis"
                      maxLength={2000}
                      rows={1}
                    />
                  </div>
                  <p className="text-xs text-white/50">
                    {(boostRewardMessage?.length || 0)} / 2000 characters
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        
        <DialogFooter className="w-full flex-col sm:flex-row gap-2 mt-6 pt-4 border-t border-white/10">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/20 text-white hover:bg-white/10 touch-feedback w-full h-11 text-base font-semibold"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

