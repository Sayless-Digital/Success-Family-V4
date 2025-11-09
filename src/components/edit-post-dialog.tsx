"use client"

import * as React from "react"
import { X, Image as ImageIcon, Mic, Play, Pause, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { MediaType, PostWithAuthor } from "@/types"
import { cn } from "@/lib/utils"
import { VoiceNoteRecorder } from "@/components/voice-note-recorder"
import { toast } from "sonner"
import { PostMediaSlider } from "@/components/post-media-slider"

interface EditPostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  post: PostWithAuthor
  onPostUpdated: (updatedPost: PostWithAuthor) => void
}

interface MediaFile {
  file: File
  preview: string
  type: MediaType
}

interface ExistingMedia {
  id: string
  preview: string
  type: MediaType
  storagePath: string
}

export function EditPostDialog({
  open,
  onOpenChange,
  post,
  onPostUpdated
}: EditPostDialogProps) {
  const { user, walletBalance, refreshWalletBalance } = useAuth()
  const [content, setContent] = React.useState(post.content)
  const [mediaFiles, setMediaFiles] = React.useState<MediaFile[]>([])
  const [existingMedia, setExistingMedia] = React.useState<ExistingMedia[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [showVoiceRecorder, setShowVoiceRecorder] = React.useState(false)
  const [playingAudio, setPlayingAudio] = React.useState<string | null>(null)
  const [audioProgress, setAudioProgress] = React.useState<Record<string, { current: number; duration: number }>>({})
  const audioRefs = React.useRef<Record<string, HTMLAudioElement>>({})
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Load existing media when dialog opens
  React.useEffect(() => {
    if (open && post.media) {
      const existing: ExistingMedia[] = post.media.map(m => ({
        id: m.id!,
        preview: supabase.storage.from('post-media').getPublicUrl(m.storage_path).data.publicUrl,
        type: m.media_type,
        storagePath: m.storage_path
      }))
      setExistingMedia(existing)
      setContent(post.content)
    }
  }, [open, post])

  const reset = () => {
    setMediaFiles([])
    setError(null)
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

  const handleAudioPlay = (previewUrl: string, index?: number) => {
    Object.keys(audioRefs.current).forEach(key => {
      if (key !== previewUrl) {
        const audio = audioRefs.current[key]
        if (audio && !audio.paused) {
          audio.pause()
          audio.currentTime = 0
        }
      }
    })

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
        if (audio.ended) {
          setPlayingAudio(null)
        }
      })
      
      audioRefs.current[previewUrl] = audio
      audio.load()
    }

    const audio = audioRefs.current[previewUrl]
    
    if (playingAudio === previewUrl) {
      audio.pause()
      setPlayingAudio(null)
    } else {
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
    if (!user) return

    if (walletBalance === null || walletBalance < 1) {
      toast.error("You need at least 1 point to add a voice note")
      setShowVoiceRecorder(false)
      return
    }

    const preview = URL.createObjectURL(audioBlob)
    const fileName = `voice-note-${Date.now()}.webm`
    const file = new File([audioBlob], fileName, { type: 'audio/webm' })

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
    })
    audio.addEventListener('pause', () => {
      if (audio.ended) {
        setPlayingAudio(null)
      }
    })
    audioRefs.current[preview] = audio
    audio.load()

    setMediaFiles(prev => [...prev, { file, preview, type: 'audio' }])
    setShowVoiceRecorder(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newFiles: MediaFile[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document'
    }))
    setMediaFiles(prev => [...prev, ...newFiles])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeMedia = (index: number) => {
    setMediaFiles(prev => {
      const newFiles = [...prev]
      const removedMedia = newFiles[index]

      if (removedMedia.type === 'audio' && audioRefs.current[removedMedia.preview]) {
        const audio = audioRefs.current[removedMedia.preview]
        audio.pause()
        audio.src = ''
        delete audioRefs.current[removedMedia.preview]
      }
      if (removedMedia.type === 'audio') {
        setAudioProgress(prev => {
          const updated = { ...prev }
          delete updated[removedMedia.preview]
          return updated
        })
      }
      URL.revokeObjectURL(removedMedia.preview)
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  const removeExistingMedia = async (mediaId: string, storagePath: string) => {
    try {
      // Delete from storage
      await supabase.storage.from('post-media').remove([storagePath])
      
      // Delete from database
      await supabase.from('post_media').delete().eq('id', mediaId)
      
      setExistingMedia(prev => prev.filter(m => m.id !== mediaId))
      toast.success("Media removed")
    } catch (error: any) {
      console.error('Error removing media:', error)
      toast.error('Failed to remove media')
    }
  }

  const handleSubmit = async () => {
    if (!user) return

    if (!content.trim() && mediaFiles.length === 0 && existingMedia.length === 0) {
      toast.error("Post cannot be empty")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // Update post content
      const { error: updateError } = await supabase
        .from('posts')
        .update({
          content: content.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', post.id)

      if (updateError) throw updateError

      // Upload new media files
      const newMedia = [...mediaFiles]
      for (let i = 0; i < newMedia.length; i++) {
        const media = newMedia[i]
        const fileName = `${post.id}-${Date.now()}-${i}.${media.file.name.split('.').pop()}`
        const filePath = `${post.community_id}/${fileName}`

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(filePath, media.file, { upsert: false })

        if (uploadError) throw uploadError

        // Deduct points for voice notes
        if (media.type === 'audio') {
          const { error: deductError } = await supabase.rpc('deduct_points_for_voice_notes', {
            p_user_id: user.id,
            p_point_cost: 1
          })
          if (deductError) throw deductError
        }

        // Create media record
        const { error: mediaError } = await supabase.from('post_media').insert({
          post_id: post.id,
          media_type: media.type,
          storage_path: filePath,
          file_name: media.file.name,
          file_size: media.file.size,
          mime_type: media.file.type,
          display_order: existingMedia.length + i
        })

        if (mediaError) throw mediaError
      }

      await refreshWalletBalance?.()

      // Fetch updated post
      const { data: updatedPostData, error: fetchError } = await supabase
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
        .eq('id', post.id)
        .single()

      if (fetchError) throw fetchError

      toast.success("Post updated successfully")
      onPostUpdated(updatedPostData as PostWithAuthor)
      reset()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error updating post:', error)
      setError(error.message || 'Failed to update post')
      toast.error(error.message || 'Failed to update post')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Post</DialogTitle>
          <DialogDescription>Update the content or media attached to this post.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full min-h-[120px] p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-white/30"
              disabled={submitting}
            />
          </div>

          {/* Existing Media */}
          {existingMedia.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-white/60">Existing Media</p>
              <div className="flex gap-2 flex-wrap">
                {existingMedia.map((media) => (
                  <div key={media.id} className="relative group">
                    {media.type === 'audio' ? (
                      <div className="w-[280px] p-3 rounded-lg bg-white/10 border border-white/20">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/60">Voice Note</span>
                          <div className="flex-1" />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeExistingMedia(media.id, media.storagePath)}
                            className="h-6 w-6 p-0 text-white/70 hover:text-white"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-white/10 border border-white/20">
                        <img
                          src={media.preview}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeExistingMedia(media.id, media.storagePath)}
                          className="absolute top-1 right-1 h-6 w-6 p-0 bg-black/50 hover:bg-black/70 text-white"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Media Preview */}
          {mediaFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-white/60">New Media</p>
              <div className="flex gap-2 flex-wrap">
                {mediaFiles.map((media, index) => (
                  <div key={index} className="relative group">
                    {media.type === 'audio' ? (
                      <div className="w-full p-3 rounded-lg bg-white/10 border border-white/20">
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-sm text-white/80">
                            {audioProgress[media.preview]?.duration
                              ? `${formatAudioTime(audioProgress[media.preview].current)} / ${formatAudioTime(audioProgress[media.preview].duration)}`
                              : '0:00 / —'}
                          </div>
                          <div className="flex-1" />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAudioPlay(media.preview, index)}
                            className="h-8 w-8 p-0"
                          >
                            {playingAudio === media.preview ? (
                              <Pause className="h-4 w-4 text-white/70" />
                            ) : (
                              <Play className="h-4 w-4 text-white/70" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMedia(index)}
                            className="h-8 w-8 p-0 text-white/70 hover:text-white"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div
                          className="w-full h-2 bg-white/10 rounded-full mt-2 cursor-pointer relative group backdrop-blur-sm overflow-visible"
                          onClick={(e) => {
                            const audio = audioRefs.current[media.preview]
                            if (audio && audioProgress[media.preview]?.duration) {
                              const rect = e.currentTarget.getBoundingClientRect()
                              const clickX = e.clientX - rect.left
                              const percentage = clickX / rect.width
                              audio.currentTime = percentage * audioProgress[media.preview].duration
                            }
                          }}
                        >
                          <div
                            className="h-full bg-gradient-to-r from-white via-white to-white transition-all duration-100 rounded-full shadow-[0_0_4px_rgba(255,255,255,0.5),0_0_8px_rgba(255,255,255,0.3)] relative"
                            style={{
                              width: audioProgress[media.preview]?.duration
                                ? `${(audioProgress[media.preview].current / audioProgress[media.preview].duration) * 100}%`
                                : '0%'
                            }}
                          >
                            <div
                              className={cn(
                                "absolute right-0 top-1/2 w-8 h-8 bg-white/90 blur-lg rounded-full pointer-events-none",
                                playingAudio === media.preview && "animate-edge-glow"
                              )}
                              style={{ transform: 'translate(50%, -50%)' }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-white/10 border border-white/20">
                        {media.type === 'image' && (
                          <img
                            src={media.preview}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                        {media.type === 'video' && (
                          <video
                            src={media.preview}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMedia(index)}
                          className="absolute top-1 right-1 h-6 w-6 p-0 bg-black/50 hover:bg-black/70 text-white"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Voice Recorder */}
          {showVoiceRecorder && (
            <VoiceNoteRecorder
              onRecordingComplete={handleVoiceNoteComplete}
              onCancel={() => setShowVoiceRecorder(false)}
              maxDurationMinutes={5}
              autoStart={true}
            />
          )}

          {/* Media Controls */}
          {!showVoiceRecorder && (
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
              >
                <ImageIcon className="h-4 w-4 text-white/70" />
                <span className="sr-only">Add Images</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowVoiceRecorder(true)}
                className="flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
              >
                <Mic className="h-4 w-4 text-white/70" />
                <span className="sr-only">Add Voice Note</span>
              </Button>
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || (!content.trim() && mediaFiles.length === 0 && existingMedia.length === 0)}
            >
              {submitting ? "Updating..." : "Update Post"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

