"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { X, Image as ImageIcon, Plus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { MediaType } from "@/types"
import { cn } from "@/lib/utils"

interface CreatePostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  communityId: string
  communitySlug: string
}

interface MediaFile {
  file: File
  preview: string
  type: MediaType
}

export function CreatePostDialog({
  open,
  onOpenChange,
  communityId,
  communitySlug
}: CreatePostDialogProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [content, setContent] = React.useState("")
  const [mediaFiles, setMediaFiles] = React.useState<MediaFile[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState<{ current: number; total: number } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const reset = () => {
    setContent("")
    setMediaFiles([])
    setUploadProgress(null)
    setError(null)
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

  const removeMedia = (index: number) => {
    setMediaFiles(prev => {
      const newFiles = [...prev]
      URL.revokeObjectURL(newFiles[index].preview)
      newFiles.splice(index, 1)
      return newFiles
    })
  }

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
      onOpenChange(false)
      router.push(`/${communitySlug}/feed`)
      router.refresh()
    } catch (e: any) {
      console.error('Error creating post:', e)
      setError(e?.message || 'Failed to create post')
    } finally {
      // CRITICAL: Always reset submitting state
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-lg">Create Post</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Unified Input Area */}
          <div className="bg-white/10 border border-white/20 rounded-lg p-4">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full bg-transparent border-0 text-white placeholder:text-white/40 text-base resize-none focus:outline-none focus:ring-0 min-h-[150px]"
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.max(150, target.scrollHeight) + 'px'
              }}
            />
          </div>

          {/* Image Preview Grid */}
          <div className="grid grid-cols-4 gap-2">
            {mediaFiles.map((media, index) => (
              <div
                key={index}
                className="relative aspect-square rounded-lg overflow-hidden bg-white/10 border border-white/20 group"
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
            
            {/* Add Image Button */}
            {mediaFiles.length < 8 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-white/20 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center"
              >
                <Plus className="h-6 w-6 text-white/40" />
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}
          
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting || !content.trim()}>
              {submitting ? (
                uploadProgress
                  ? `Uploading image ${uploadProgress.current} of ${uploadProgress.total}`
                  : 'Posting…'
              ) : 'Post'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}