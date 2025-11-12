"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { X, Plus, ChevronLeft, ChevronRight, Mic, Image as ImageIcon, Play, Pause, Trash2, Crown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import type { MediaType, PostWithAuthor } from "@/types"
import { cn } from "@/lib/utils"
import { VoiceNoteRecorder } from "@/components/voice-note-recorder"
import { toast } from "sonner"
import { BoostRewardsDialog } from "@/components/boost-rewards-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface InlinePostComposerProps {
  communityId: string
  communitySlug: string
  parentPostId?: string | null
  mode?: "post" | "comment" | "reply"
  collapsedLabel?: string
  placeholder?: string
  allowImages?: boolean
  allowVoiceNote?: boolean
  initialExpanded?: boolean
  disableRouterRefresh?: boolean
  hideCollapsedTrigger?: boolean
  onPostCreated?: (post: PostWithAuthor) => void
  onExpandedChange?: (isExpanded: boolean) => void
  className?: string
  contentClassName?: string
  communityOptions?: {
    id: string
    name: string
    slug: string
    logoUrl?: string | null
  }[]
  selectedCommunityId?: string
  onCommunityChange?: (communityId: string) => void
}

interface MediaFile {
  file: File
  preview: string
  type: MediaType
  requiresBoost?: boolean
}

export function InlinePostComposer({
  communityId,
  communitySlug,
  parentPostId = null,
  mode = "post",
  collapsedLabel,
  placeholder,
  allowImages,
  allowVoiceNote,
  initialExpanded,
  disableRouterRefresh,
  hideCollapsedTrigger,
  onPostCreated,
  onExpandedChange,
  className,
  contentClassName,
  communityOptions,
  selectedCommunityId,
  onCommunityChange,
}: InlinePostComposerProps) {
  const router = useRouter()
  const { user, userProfile, walletBalance, walletEarningsBalance, refreshWalletBalance } = useAuth()
  const resolvedMode = mode ?? "post"
  const resolvedAllowImages = allowImages ?? resolvedMode === "post"
  const resolvedAllowVoiceNote = allowVoiceNote ?? resolvedMode !== "reply"
  const resolvedCommunityOptions = communityOptions ?? []
  const resolvedSelectedCommunityId = selectedCommunityId ?? communityId
  const currentCommunity = React.useMemo(
    () =>
      resolvedCommunityOptions.find((option) => option.id === resolvedSelectedCommunityId) ??
      resolvedCommunityOptions.find((option) => option.id === communityId),
    [resolvedCommunityOptions, resolvedSelectedCommunityId, communityId]
  )

  const collapsedLabelText = collapsedLabel ?? (
    resolvedMode === "post"
      ? "Write something valuable..."
      : resolvedMode === "comment"
        ? "What's on your mind?"
        : "Reply to this comment..."
  )
  const placeholderText = placeholder ?? (
    resolvedMode === "post"
      ? "Write something valuable"
      : resolvedMode === "comment"
        ? "What's on your mind?"
        : "Share your reply..."
  )
  const initialExpandedState = hideCollapsedTrigger ? true : initialExpanded ?? false
  const [isExpanded, setIsExpanded] = React.useState(initialExpandedState)

  // Notify parent when expanded state changes
  React.useEffect(() => {
    onExpandedChange?.(isExpanded)
  }, [isExpanded, onExpandedChange])
  const [content, setContent] = React.useState("")
  const [voiceNote, setVoiceNote] = React.useState<MediaFile | null>(null)
  const [imageFiles, setImageFiles] = React.useState<MediaFile[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [showBoostRewardsDialog, setShowBoostRewardsDialog] = React.useState(false)
  const [boostRewardMessage, setBoostRewardMessage] = React.useState<string>("")
  const [uploadProgress, setUploadProgress] = React.useState<{ current: number; total: number } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [showVoiceRecorder, setShowVoiceRecorder] = React.useState(false)
  const [playingAudio, setPlayingAudio] = React.useState<string | null>(null)
  const [audioProgress, setAudioProgress] = React.useState<Record<string, { current: number; duration: number }>>({})
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const audioRefs = React.useRef<Record<string, HTMLAudioElement>>({})
  const [canScrollLeft, setCanScrollLeft] = React.useState(false)
  const [canScrollRight, setCanScrollRight] = React.useState(false)
  const trimmedContent = content.trim()
  const hasVoiceNote = !!voiceNote
  const hasImages = imageFiles.length > 0
  const canSubmitContent =
    trimmedContent.length > 0 ||
    (resolvedAllowVoiceNote && hasVoiceNote) ||
    (resolvedAllowImages && hasImages)
  const isSubmitDisabled = submitting || showVoiceRecorder || !canSubmitContent
  const submitLabel =
    resolvedMode === "post" ? "Post" : resolvedMode === "comment" ? "Contribute" : "Reply"
  const showCommunitySelector =
    isExpanded &&
    resolvedCommunityOptions.length > 0 &&
    typeof onCommunityChange === "function"
  const reset = () => {
    setContent("")
    setVoiceNote(null)
    setImageFiles([])
    setBoostRewardMessage("")
    setUploadProgress(null)
    setError(null)
    setIsExpanded(initialExpandedState)
    setShowVoiceRecorder(false)
    setPlayingAudio(null)
    setAudioProgress({})
    // Cleanup audio elements
    Object.values(audioRefs.current).forEach(audio => {
      audio.pause()
      audio.src = ''
    })
    audioRefs.current = {}
  }

  const handleAudioPlay = (previewUrl: string) => {
    // Stop any OTHER currently playing audio (not the one we're about to play)
    Object.keys(audioRefs.current).forEach(key => {
      if (key !== previewUrl) {
        const audio = audioRefs.current[key]
        if (audio && !audio.paused) {
          audio.pause()
          audio.currentTime = 0
        }
      }
    })

    // Create or get audio element
    if (!audioRefs.current[previewUrl]) {
      const audio = new Audio(previewUrl)
      
      audio.addEventListener('loadedmetadata', () => {
        setAudioProgress(prev => ({
          ...prev,
          [previewUrl]: {
            current: 0,
            duration: audio.duration || 0
          }
        }))
      })
      
      audio.addEventListener('timeupdate', () => {
        setAudioProgress(prev => ({
          ...prev,
          [previewUrl]: {
            current: audio.currentTime,
            duration: audio.duration || 0
          }
        }))
      })
      
      audio.addEventListener('ended', () => {
        setPlayingAudio(null)
        setAudioProgress(prev => ({
          ...prev,
          [previewUrl]: {
            current: 0,
            duration: prev[previewUrl]?.duration || 0
          }
        }))
      })
      
      audio.addEventListener('pause', () => {
        // Only clear playing state if audio ended or is at the start
        // Don't clear it on normal pause so position is preserved
        if (audio.ended) {
          setPlayingAudio(null)
        }
      })
      
      audioRefs.current[previewUrl] = audio
      
      // Load metadata to get duration
      audio.load()
    }

    const audio = audioRefs.current[previewUrl]
    
    if (playingAudio === previewUrl) {
      // Pause if already playing - preserve currentTime
      audio.pause()
      setPlayingAudio(null)
    } else {
      // Play (or resume from where it was paused)
      audio.play()
      setPlayingAudio(previewUrl)
    }
  }

  const formatAudioTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleVoiceNoteComplete = async (audioBlob: Blob) => {
    if (!resolvedAllowVoiceNote) return
    if (!user) return

    // Check wallet balance (skip for admins)
    const isAdmin = userProfile?.role === 'admin'
    // Check combined balance (wallet + earnings)
    const availableBalance = (walletBalance ?? 0) + (walletEarningsBalance ?? 0)
    if (!isAdmin && availableBalance < 1) {
      toast.error("You need at least 1 point to add a voice note")
      setShowVoiceRecorder(false)
      return
    }

    // Create preview URL
    const preview = URL.createObjectURL(audioBlob)
    
    // Create file from blob
    const fileName = `voice-note-${Date.now()}.webm`
    const file = new File([audioBlob], fileName, { type: 'audio/webm' })
    
    // Immediately load audio metadata to get duration
    const audio = new Audio(preview)
    
    audio.addEventListener('loadedmetadata', () => {
      setAudioProgress(prev => ({
        ...prev,
        [preview]: {
          current: 0,
          duration: audio.duration || 0
        }
      }))
    })
    
    audio.addEventListener('timeupdate', () => {
      setAudioProgress(prev => ({
        ...prev,
        [preview]: {
          current: audio.currentTime,
          duration: audio.duration || 0
        }
      }))
    })
    
    audio.addEventListener('ended', () => {
      setPlayingAudio(null)
      setAudioProgress(prev => ({
        ...prev,
        [preview]: {
          current: 0,
          duration: prev[preview]?.duration || 0
        }
      }))
    })
    
    audio.addEventListener('pause', () => {
      if (audio.currentTime === 0 || audio.ended) {
        setPlayingAudio(null)
      }
    })
    
    // Store audio element for later playback
    audioRefs.current[preview] = audio
    audio.load()
    
    // Replace existing voice note if any (only one allowed)
    setVoiceNote({ file, preview, type: 'audio', requiresBoost: false })
    setShowVoiceRecorder(false)
  }

  const handleVoiceNoteCancel = () => {
    if (!resolvedAllowVoiceNote) return
    setShowVoiceRecorder(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!resolvedAllowImages) return
    const files = Array.from(e.target.files || [])
    
    files.forEach(file => {
      // Only accept images for now
      if (!file.type.startsWith('image/')) {
        return
      }

      // Create preview URL
      const preview = URL.createObjectURL(file)
      
      setImageFiles(prev => [...prev, { file, preview, type: 'image' }])
    })

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const updateScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
    }
  }

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' })
    }
  }

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' })
    }
  }

  React.useEffect(() => {
    if (error && canSubmitContent) {
      setError(null)
    }
  }, [canSubmitContent, error])

  const removeVoiceNote = () => {
    if (!voiceNote) return
    
    // Cleanup audio element if it exists
    if (audioRefs.current[voiceNote.preview]) {
      const audio = audioRefs.current[voiceNote.preview]
      audio.pause()
      audio.src = ''
      delete audioRefs.current[voiceNote.preview]
    }
    
    // Cleanup audio progress
    setAudioProgress(prev => {
      const updated = { ...prev }
      delete updated[voiceNote.preview]
      return updated
    })
    
    URL.revokeObjectURL(voiceNote.preview)
    setVoiceNote(null)
    setPlayingAudio(null)
  }

  const removeImage = (index: number) => {
    setImageFiles(prev => {
      const newFiles = [...prev]
      const removedImage = newFiles[index]
      URL.revokeObjectURL(removedImage.preview)
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  React.useEffect(() => {
    updateScrollButtons()
        }, [imageFiles])

        React.useEffect(() => {
          // Cleanup audio elements on unmount
          return () => {
            Object.values(audioRefs.current).forEach(audio => {
              audio.pause()
              audio.src = ''
            })
          }
        }, [])

  const uploadMedia = async (postId: string): Promise<void> => {
    const totalFiles = (voiceNote ? 1 : 0) + imageFiles.length
    if (totalFiles === 0) return

    console.log(`Uploading ${totalFiles} media files for post ${postId}`)

    // Deduct points for voice note if present (admins bypass this in the database function)
    if (voiceNote && user) {
      const { error: pointsError } = await supabase.rpc('deduct_points_for_voice_notes', {
        p_user_id: user.id,
        p_point_cost: 1
      })

      if (pointsError) {
        console.error('Points deduction error:', pointsError)
        throw new Error(`Failed to deduct points: ${pointsError.message}`)
      }

      // Refresh wallet balance (only if not admin, as admin won't have points deducted)
      const isAdmin = userProfile?.role === 'admin'
      if (!isAdmin) {
        await refreshWalletBalance()
      }
    }

    let displayOrder = 0

    // Upload voice note first (if present)
    if (voiceNote) {
      setUploadProgress({ current: 1, total: totalFiles })
      
      const { file, type, requiresBoost } = voiceNote
      const fileExt = file.name.split('.').pop()
      const timestamp = Date.now()
      const fileName = `${timestamp}-voice.${fileExt}`
      const filePath = `${user!.id}/${postId}/${fileName}`

      console.log(`Uploading voice note: ${filePath}`)

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(filePath, file, {
          contentType: file.type,
          cacheControl: '0',
          upsert: false
        })

      if (uploadError) {
        console.error('Media upload error:', uploadError)
        throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`)
      }

      const { data: mediaData, error: mediaError } = await supabase
        .from('post_media')
        .insert({
          post_id: postId,
          media_type: type,
          storage_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          display_order: displayOrder++,
          requires_boost: requiresBoost || false
        })
        .select()

      if (mediaError) {
        console.error('Media record error:', mediaError)
        throw new Error(`Failed to create media record: ${mediaError.message}`)
      }
    }

    // Upload images
    for (let i = 0; i < imageFiles.length; i++) {
      setUploadProgress({ current: (voiceNote ? 2 : 1) + i, total: totalFiles })
      
      const { file, type } = imageFiles[i]
      const fileExt = file.name.split('.').pop()
      const timestamp = Date.now()
      const fileName = `${timestamp}-${i}.${fileExt}`
      const filePath = `${user!.id}/${postId}/${fileName}`

      console.log(`Uploading image ${i + 1}/${imageFiles.length}: ${filePath}`)

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(filePath, file, {
          contentType: file.type,
          cacheControl: '0',
          upsert: false
        })

      if (uploadError) {
        console.error('Media upload error:', uploadError)
        throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`)
      }

      const { data: mediaData, error: mediaError } = await supabase
        .from('post_media')
        .insert({
          post_id: postId,
          media_type: type,
          storage_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          display_order: displayOrder++
        })
        .select()

      if (mediaError) {
        console.error('Media record error:', mediaError)
        throw new Error(`Failed to create media record: ${mediaError.message}`)
      }
    }

    console.log('All media uploaded successfully')
    setUploadProgress(null)
  }

  const handleCreate = async () => {
    if (!user) {
      setError("Please sign in to create a post.")
      return
    }
    
    const currentTrimmedContent = content.trim()
    const currentHasVoiceNote = !!voiceNote
    const currentHasImages = imageFiles.length > 0
    const isValidContent =
      currentTrimmedContent.length > 0 ||
      (resolvedAllowVoiceNote && currentHasVoiceNote) ||
      (resolvedAllowImages && currentHasImages)

    if (!isValidContent) {
      setError(
        resolvedAllowVoiceNote || resolvedAllowImages
          ? "Please add some text or media before sharing."
          : "Please add some text before sharing."
      )
      return
    }

    setSubmitting(true)
    setError(null)
    
    try {
      const contentToSave = currentTrimmedContent.length > 0 ? currentTrimmedContent : ""
      const hasBoostRewardMessage = boostRewardMessage.trim().length > 0
      
      // Check balance for boost reward message (skip for admins)
      const isAdmin = userProfile?.role === 'admin'
      if (hasBoostRewardMessage && !isAdmin) {
        const availableBalance = (walletBalance ?? 0) + (walletEarningsBalance ?? 0)
        if (availableBalance < 1) {
          setError("You need at least 1 point to add a boost reward message")
          setSubmitting(false)
          return
        }
      }
      
      const { data: insertedPost, error: postError } = await supabase
        .from('posts')
        .insert({
          community_id: communityId,
          author_id: user.id,
          content: contentToSave,
          parent_post_id: parentPostId,
          published_at: new Date().toISOString(),
          boost_reward_message: boostRewardMessage.trim() || null
        })
        .select(`
          *,
          author:users!posts_author_id_fkey(
            id,
            username,
            first_name,
            last_name,
            profile_picture
          ),
          media:post_media(
            id,
            media_type,
            storage_path,
            file_name,
            display_order
          )
        `)
        .single()

      if (postError) {
        throw new Error(`Failed to create post: ${postError.message}`)
      }

      // Deduct points for boost reward message if present (admins bypass this)
      if (hasBoostRewardMessage && user) {
        const isAdmin = userProfile?.role === 'admin'
        if (!isAdmin) {
          const { error: pointsError } = await supabase.rpc('deduct_points_for_voice_notes', {
            p_user_id: user.id,
            p_point_cost: 1
          })

          if (pointsError) {
            console.error('Points deduction error for boost reward message:', pointsError)
            throw new Error(`Failed to deduct points: ${pointsError.message}`)
          }

          await refreshWalletBalance()
        }
      }

      // Upload media if any
      if ((resolvedAllowVoiceNote && voiceNote) || (resolvedAllowImages && imageFiles.length > 0)) {
        await uploadMedia(insertedPost.id)
      }

      let createdPost = insertedPost

      if ((resolvedAllowVoiceNote && voiceNote) || (resolvedAllowImages && imageFiles.length > 0)) {
        const { data: refreshedPost, error: refreshError } = await supabase
          .from('posts')
          .select(`
            *,
            author:users!posts_author_id_fkey(
              id,
              username,
              first_name,
              last_name,
              profile_picture
            ),
            media:post_media(
              id,
              media_type,
              storage_path,
              file_name,
              display_order
            )
          `)
          .eq('id', insertedPost.id)
          .single()

        if (!refreshError && refreshedPost) {
          createdPost = refreshedPost
        }
      }

      if (onPostCreated && createdPost) {
        onPostCreated(createdPost as PostWithAuthor)
      }

      reset()
      if (!disableRouterRefresh) {
      router.refresh()
      }
    } catch (e: any) {
      console.error('Error creating post:', e)
      setError(e?.message || 'Failed to create post')
    } finally {
      // CRITICAL: Always reset submitting state
      setSubmitting(false)
    }
  }

  React.useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isExpanded])

  if (!userProfile) return null

  return (
    <Card className={cn(
      "bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 transition-all",
      isExpanded ? "" : "hover:bg-white/15 cursor-pointer",
      className
    )}>
      <CardContent className={cn("p-3", contentClassName)}>
        {!hideCollapsedTrigger && !isExpanded ? (
          // Collapsed State - Click to Expand
          <div 
            className="flex items-center gap-3"
            onClick={() => setIsExpanded(true)}
          >
            <Avatar className="h-10 w-10 border-4 border-white/20 flex-shrink-0" userId={user?.id}>
              <AvatarImage src={userProfile.profile_picture} alt={`${userProfile.first_name} ${userProfile.last_name}`} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm">
                {userProfile.first_name[0]}{userProfile.last_name[0]}
              </AvatarFallback>
            </Avatar>
            <p className="text-white/50 text-base flex-1">{collapsedLabelText}</p>
          </div>
        ) : (
          // Expanded State - Full Composer
          <div className="space-y-4">
            {/* Header with Avatar and Community Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-3 flex-1">
                <Avatar className="h-10 w-10 border-4 border-white/20 flex-shrink-0" userId={user?.id}>
                  <AvatarImage src={userProfile.profile_picture} alt={`${userProfile.first_name} ${userProfile.last_name}`} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm">
                    {userProfile.first_name[0]}{userProfile.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-white/80 text-sm font-medium">
                  {userProfile.first_name} {userProfile.last_name}
                </span>
              </div>

              {showCommunitySelector && (
                <Select
                  value={resolvedSelectedCommunityId}
                  onValueChange={(value) => onCommunityChange?.(value)}
                >
                  <SelectTrigger className="w-full sm:w-auto sm:ml-auto min-w-[200px] bg-white/10 border border-white/20 text-left text-white/80 hover:bg-white/15 [&>span]:hidden">
                    <SelectValue>
                      {currentCommunity?.name ?? "Select a community"}
                    </SelectValue>
                    <div className="flex items-center gap-2 flex-1">
                      <Avatar className="h-6 w-6 border border-white/20 flex-shrink-0">
                        <AvatarImage
                          src={currentCommunity?.logoUrl || undefined}
                          alt={currentCommunity ? `${currentCommunity.name} logo` : "Community logo"}
                        />
                        <AvatarFallback className="bg-white/10 text-white/80 text-xs uppercase">
                          {currentCommunity?.name
                            ? currentCommunity.name.slice(0, 2).toUpperCase()
                            : "SF"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-white/80 truncate">
                        {currentCommunity?.name ?? "Select a community"}
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {resolvedCommunityOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 border border-white/20 flex-shrink-0">
                            <AvatarImage
                              src={option.logoUrl || undefined}
                              alt={`${option.name} logo`}
                            />
                            <AvatarFallback className="bg-white/10 text-white/80 text-xs uppercase">
                              {option.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-white/80">
                            {option.name}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Text Input */}
            <div className="bg-white/10 border border-white/20 rounded-lg p-4">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={placeholderText}
                className="w-full bg-transparent border-0 text-white placeholder:text-white/40 text-base resize-none focus:outline-none focus:ring-0 min-h-[100px]"
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = Math.max(100, target.scrollHeight) + 'px'
                }}
              />
            </div>

            {/* Voice Note Recorder */}
            {resolvedAllowVoiceNote && showVoiceRecorder && (
              <VoiceNoteRecorder
                onRecordingComplete={handleVoiceNoteComplete}
                onCancel={handleVoiceNoteCancel}
                maxDurationMinutes={5}
                autoStart={true}
              />
            )}

            {/* Voice Note Preview - Separate Container */}
            {resolvedAllowVoiceNote && voiceNote && (
              <div className="rounded-lg overflow-hidden bg-white/10 border border-white/20 relative">
                {voiceNote.requiresBoost && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm">
                    <Crown className="h-3 w-3 text-white/80" />
                    <span className="text-xs font-medium text-white/80">Boost reward</span>
                  </div>
                )}
                <div className="p-3 relative overflow-hidden">
                  <div className="flex items-center gap-2">
                    <div className="font-mono text-sm text-white/80">
                      {audioProgress[voiceNote.preview]?.duration 
                        ? `${formatAudioTime(audioProgress[voiceNote.preview].current)} / ${formatAudioTime(audioProgress[voiceNote.preview].duration)}`
                        : `0:00 / —`
                      }
                    </div>
                    {playingAudio === voiceNote.preview && audioRefs.current[voiceNote.preview]?.paused && (
                      <>
                        <div className="text-white/40">•</div>
                        <span className="text-xs text-white/60">Paused</span>
                      </>
                    )}
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAudioPlay(voiceNote.preview)
                      }}
                      className="flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
                    >
                      {playingAudio === voiceNote.preview ? (
                        <Pause className="h-4 w-4 text-white/70 hover:text-white/80 transition-all" />
                      ) : (
                        <Play className="h-4 w-4 text-white/70 hover:text-white/80 transition-all" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeVoiceNote()
                      }}
                      className="flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30 flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-white/70 hover:text-white/80 transition-all" />
                    </button>
                  </div>
                  <div 
                    className="w-full h-2 bg-white/10 rounded-full mt-2 cursor-pointer relative group backdrop-blur-sm overflow-visible"
                    onClick={(e) => {
                      const audio = audioRefs.current[voiceNote.preview]
                      if (!audio || !audioProgress[voiceNote.preview]?.duration) return
                      
                      const rect = e.currentTarget.getBoundingClientRect()
                      const clickX = e.clientX - rect.left
                      const percentage = clickX / rect.width
                      const newTime = percentage * audioProgress[voiceNote.preview].duration
                      
                      audio.currentTime = Math.max(0, Math.min(newTime, audio.duration))
                      setAudioProgress(prev => ({
                        ...prev,
                        [voiceNote.preview]: {
                          current: audio.currentTime,
                          duration: prev[voiceNote.preview]?.duration || 0
                        }
                      }))
                    }}
                  >
                    <div 
                      className="h-full bg-gradient-to-r from-white via-white to-white transition-all duration-100 rounded-full shadow-[0_0_4px_rgba(255,255,255,0.5),0_0_8px_rgba(255,255,255,0.3)] relative"
                      style={{ 
                        width: audioProgress[voiceNote.preview]?.duration 
                          ? `${(audioProgress[voiceNote.preview].current / audioProgress[voiceNote.preview].duration) * 100}%`
                          : '0%'
                      }}
                    >
                      <div 
                        className={cn(
                          "absolute right-0 top-1/2 w-8 h-8 bg-white/90 blur-lg rounded-full pointer-events-none",
                          playingAudio === voiceNote.preview && "animate-edge-glow"
                        )}
                        style={{
                          transform: 'translate(50%, -50%)'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Images Preview Slider */}
            {resolvedAllowImages && imageFiles.length > 0 && (
              <div className="relative">
                {/* Left Navigation Button */}
                {canScrollLeft && (
                  <button
                    type="button"
                    onClick={scrollLeft}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="h-5 w-5 text-white" />
                  </button>
                )}

                {/* Scrollable Container */}
                <div
                  ref={scrollContainerRef}
                  onScroll={updateScrollButtons}
                  className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {imageFiles.map((image, index) => (
                    <div
                      key={index}
                      className="relative flex-shrink-0 rounded-lg overflow-hidden bg-white/10 border border-white/20 group"
                      style={{
                        width: 'calc((100% - 3 * 0.5rem) / 4)',
                        aspectRatio: '1 / 1',
                      }}
                    >
                      <img
                        src={image.preview}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Right Navigation Button */}
                {canScrollRight && (
                  <button
                    type="button"
                    onClick={scrollRight}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="h-5 w-5 text-white" />
                  </button>
                )}
              </div>
            )}

            {resolvedAllowImages && (
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              {resolvedAllowImages && (
                <button
                  type="button"
                onClick={() => fileInputRef.current?.click()}
                  disabled={submitting || imageFiles.length >= 8 || showVoiceRecorder}
                  className="group relative flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
                >
                  <ImageIcon className="h-4 w-4 text-white/70 group-hover:text-white/80 transition-all" />
                  <span className="sr-only">
                    Add Images {imageFiles.length > 0 && `(${imageFiles.length}/8)`}
                  </span>
                </button>
              )}

              {resolvedAllowVoiceNote && (
                <button
                  type="button"
                  onClick={() => {
                    const isAdmin = userProfile?.role === 'admin'
                    const availableBalance = (walletBalance ?? 0) + (walletEarningsBalance ?? 0)
                    if (!isAdmin && availableBalance < 1) {
                      toast.error("You need at least 1 point to record a voice note")
                      return
                    }
                    setShowVoiceRecorder(true)
                  }}
                  disabled={submitting || showVoiceRecorder || !!voiceNote}
                  className="group relative flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
                >
                  <Mic className="h-4 w-4 text-white/70 group-hover:text-white/80 transition-all" />
                  <span className="sr-only">Voice Note</span>
                </button>
              )}

              {resolvedAllowVoiceNote && (
                <button
                  type="button"
                  onClick={() => setShowBoostRewardsDialog(true)}
                  disabled={submitting || showVoiceRecorder}
                  className="group relative flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
                  title="Set boost rewards"
                >
                  <Crown className={cn(
                    "h-4 w-4 text-white/70 group-hover:text-white/80 transition-all",
                    voiceNote?.requiresBoost && "text-white/90"
                  )} />
                  <span className="sr-only">Boost Rewards</span>
                </button>
              )}

              <div className="flex-1" />

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault()
                  reset()
                }}
                disabled={submitting}
                className="text-white/70 hover:text-white"
              >
                Cancel
              </Button>

              <Button
                size="sm"
                onClick={handleCreate}
                disabled={isSubmitDisabled}
                className="cursor-pointer"
              >
                {submitting ? (
                  uploadProgress
                    ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}`
                    : 'Posting…'
                ) : submitLabel}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      
      {/* Boost Rewards Dialog */}
      <BoostRewardsDialog
        open={showBoostRewardsDialog}
        onOpenChange={setShowBoostRewardsDialog}
        requiresBoost={voiceNote?.requiresBoost || false}
        onRequiresBoostChange={(requiresBoost) => {
          setVoiceNote(prev => prev ? { ...prev, requiresBoost } : null)
        }}
        boostRewardMessage={boostRewardMessage}
        onBoostRewardMessageChange={setBoostRewardMessage}
        mediaType={voiceNote ? "audio" : undefined}
      />
    </Card>
  )
}