"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { X, Plus, ChevronLeft, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { MediaType } from "@/types"
import { cn } from "@/lib/utils"

interface InlinePostComposerProps {
  communityId: string
  communitySlug: string
}

interface MediaFile {
  file: File
  preview: string
  type: MediaType
}

export function InlinePostComposer({
  communityId,
  communitySlug
}: InlinePostComposerProps) {
  const router = useRouter()
  const { user, userProfile } = useAuth()
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [content, setContent] = React.useState("")
  const [mediaFiles, setMediaFiles] = React.useState<MediaFile[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState<{ current: number; total: number } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = React.useState(false)
  const [canScrollRight, setCanScrollRight] = React.useState(false)

  const reset = () => {
    setContent("")
    setMediaFiles([])
    setUploadProgress(null)
    setError(null)
    setIsExpanded(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    files.forEach(file => {
      // Only accept images for now
      if (!file.type.startsWith('image/')) {
        return
      }

      // Create preview URL
      const preview = URL.createObjectURL(file)
      
      setMediaFiles(prev => [...prev, { file, preview, type: 'image' }])
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

  const removeMedia = (index: number) => {
    setMediaFiles(prev => {
      const newFiles = [...prev]
      URL.revokeObjectURL(newFiles[index].preview)
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  React.useEffect(() => {
    updateScrollButtons()
  }, [mediaFiles])

  const uploadMedia = async (postId: string): Promise<void> => {
    if (mediaFiles.length === 0) return

    const totalFiles = mediaFiles.length
    console.log(`Uploading ${totalFiles} media files for post ${postId}`)

    for (let i = 0; i < totalFiles; i++) {
      // Update progress
      setUploadProgress({ current: i + 1, total: totalFiles })

      const { file, type } = mediaFiles[i]
      const fileExt = file.name.split('.').pop()
      const timestamp = Date.now()
      const fileName = `${timestamp}-${i}.${fileExt}`
      const filePath = `${user!.id}/${postId}/${fileName}`

      console.log(`Uploading file ${i + 1}/${totalFiles}: ${filePath}`)

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(filePath, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Media upload error:', uploadError)
        throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`)
      }

      console.log(`Upload successful:`, uploadData)

      // Create media record
      const { data: mediaData, error: mediaError } = await supabase
        .from('post_media')
        .insert({
          post_id: postId,
          media_type: type,
          storage_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          display_order: i
        })
        .select()

      if (mediaError) {
        console.error('Media record error:', mediaError)
        throw new Error(`Failed to create media record: ${mediaError.message}`)
      }

      console.log(`Media record created:`, mediaData)
    }

    console.log('All media uploaded successfully')
    setUploadProgress(null)
  }

  const handleCreate = async () => {
    if (!user) {
      setError("Please sign in to create a post.")
      return
    }
    
    const trimmedContent = content.trim()
    if (!trimmedContent) {
      setError("Post content is required.")
      return
    }

    setSubmitting(true)
    setError(null)
    
    try {
      console.log('Creating post...')
      
      // Create post
      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({
          community_id: communityId,
          author_id: user.id,
          content: trimmedContent,
          published_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (postError) {
        console.error('Post creation error:', postError)
        throw new Error(`Failed to create post: ${postError.message}`)
      }

      console.log('Post created:', post)

      // Upload media if any
      if (mediaFiles.length > 0) {
        await uploadMedia(post.id)
      }

      console.log('Post creation complete')

      reset()
      router.refresh()
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
      isExpanded ? "" : "hover:bg-white/15 cursor-pointer"
    )}>
      <CardContent className="p-3">
        {!isExpanded ? (
          // Collapsed State - Click to Expand
          <div 
            className="flex items-center gap-3"
            onClick={() => setIsExpanded(true)}
          >
            <Avatar className="h-10 w-10 border-4 border-white/20 flex-shrink-0">
              <AvatarImage src={userProfile.profile_picture} alt={`${userProfile.first_name} ${userProfile.last_name}`} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm">
                {userProfile.first_name[0]}{userProfile.last_name[0]}
              </AvatarFallback>
            </Avatar>
            <p className="text-white/50 text-base flex-1">Write something...</p>
          </div>
        ) : (
          // Expanded State - Full Composer
          <div className="space-y-4">
            {/* Header with Avatar */}
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border-4 border-white/20 flex-shrink-0">
                <AvatarImage src={userProfile.profile_picture} alt={`${userProfile.first_name} ${userProfile.last_name}`} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm">
                  {userProfile.first_name[0]}{userProfile.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <span className="text-white/80 text-sm font-medium flex-1">
                {userProfile.first_name} {userProfile.last_name}
              </span>
            </div>

            {/* Text Input */}
            <div className="bg-white/10 border border-white/20 rounded-lg p-4">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full bg-transparent border-0 text-white placeholder:text-white/40 text-base resize-none focus:outline-none focus:ring-0 min-h-[100px]"
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = Math.max(100, target.scrollHeight) + 'px'
                }}
              />
            </div>

            {/* Image Preview Slider */}
            {mediaFiles.length > 0 && (
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
                  {mediaFiles.map((media, index) => (
                    <div
                      key={index}
                      className="relative flex-shrink-0 rounded-lg overflow-hidden bg-white/10 border border-white/20 group"
                      style={{
                        width: 'calc((100% - 3 * 0.5rem) / 4)',
                        aspectRatio: '1 / 1'
                      }}
                    >
                      <img
                        src={media.preview}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeMedia(index)}
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

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {error && <p className="text-sm text-red-400">{error}</p>}
            
            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting || mediaFiles.length >= 8}
                className="text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Images {mediaFiles.length > 0 && `(${mediaFiles.length}/8)`}
              </Button>

              <Button
                size="sm"
                onClick={handleCreate}
                disabled={submitting || !content.trim()}
                className="cursor-pointer"
              >
                {submitting ? (
                  uploadProgress
                    ? `Uploading image ${uploadProgress.current} of ${uploadProgress.total}`
                    : 'Posting…'
                ) : 'Post'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}