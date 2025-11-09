"use client"

import React, { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Video, Calendar, Download, Trash2, MoreVertical, Loader2, Upload, FileVideo } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CommunityNavigation } from "@/components/community-navigation"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { EventRecording, UploadedVideo } from "@/types"
import { SecureVideoCard, CarouselItem } from "@/app/[slug]/playlists/components/playlist-media-carousel"

// Helper function for date formatting
function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatFileSize(bytes?: number) {
  if (!bytes) return "N/A"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return null
  const totalSeconds = Math.round(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`
  }
  return `${remainingSeconds}s`
}

interface CommunityVideosViewProps {
  community: {
    id: string
    name: string
    slug: string
    owner_id: string
  }
  recordings: Array<EventRecording & {
    event?: {
      id: string
      scheduled_at: string
      started_at?: string
      ended_at?: string
      description?: string
      owner?: {
        id: string
        username: string
        first_name: string
        last_name: string
      }
    }
  }>
  isOwner: boolean
  isMember: boolean
  currentUserId?: string
  uploadedVideos: UploadedVideo[]
}

export default function CommunityVideosView({ 
  community, 
  recordings,
  isOwner,
  isMember,
  currentUserId,
  uploadedVideos
}: CommunityVideosViewProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"recordings" | "uploads">(() => {
    if (recordings.length > 0) return "recordings"
    if (uploadedVideos.length > 0) return "uploads"
    return "recordings"
  })
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadTitle, setUploadTitle] = useState("")
  const [uploadDescription, setUploadDescription] = useState("")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: "recording" | "upload" } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const hasRecordings = recordings.length > 0
  const hasUploadedVideos = uploadedVideos.length > 0
  React.useEffect(() => {
    if (activeTab === "recordings" && !hasRecordings && hasUploadedVideos) {
      setActiveTab("uploads")
    }
    if (activeTab === "uploads" && !hasUploadedVideos && hasRecordings) {
      setActiveTab("recordings")
    }
  }, [activeTab, hasRecordings, hasUploadedVideos])

  const resetUploadForm = () => {
    setUploadTitle("")
    setUploadDescription("")
    setUploadFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleUploadDialogChange = (open: boolean) => {
    setUploadDialogOpen(open)
    if (!open) {
      resetUploadForm()
      setIsUploading(false)
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && !file.type.startsWith("video")) {
      toast.error("Please select a video file (mp4, webm, mov)")
      event.target.value = ""
      return
    }
    setUploadFile(file ?? null)
  }

  const triggerFilePicker = () => {
    fileInputRef.current?.click()
  }

  const handleFilePickerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      triggerFilePicker()
    }
  }

  const clearSelectedFile = () => {
    setUploadFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleUploadSubmit = async () => {
    if (!isOwner) {
      toast.error("Only community owners can upload videos")
      return
    }

    if (!uploadFile) {
      toast.error("Please choose a video to upload")
      return
    }

    const formData = new FormData()
    formData.append("communityId", community.id)
    formData.append("title", uploadTitle.trim() || uploadFile.name)
    if (uploadDescription.trim()) {
      formData.append("description", uploadDescription.trim())
    }
    formData.append("file", uploadFile)

    setIsUploading(true)
    try {
      const response = await fetch(`/api/videos/upload`, {
        method: "POST",
        body: formData,
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to upload video")
      }

      toast.success("Video uploaded successfully")
      handleUploadDialogChange(false)
      setActiveTab("uploads")
      router.refresh()
    } catch (error: any) {
      console.error("Error uploading video:", error)
      toast.error(error.message || "Failed to upload video")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownloadRecording = async (recording: EventRecording) => {
    if (recording.storage_url) {
      // Download from Supabase Storage
      window.open(recording.storage_url, '_blank')
    } else if (recording.stream_recording_url) {
      // Download from Stream.io
      window.open(recording.stream_recording_url, '_blank')
    } else {
      toast.error("Recording URL not available")
    }
  }

  const handleDownloadUploadedVideo = (video: UploadedVideo) => {
    if (video?.storage_url) {
      window.open(video.storage_url, '_blank')
    } else {
      toast.error("Video URL not available")
    }
  }

  const handleDeleteDialogChange = (open: boolean) => {
    setDeleteDialogOpen(open)
    if (!open) {
      setDeleteTarget(null)
    }
  }

  const openDeleteDialog = (target: { id: string; type: "recording" | "upload" }) => {
    setDeleteTarget(target)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !isOwner) return

    setIsDeleting(true)
    try {
      if (deleteTarget.type === "recording") {
        const recording = recordings.find(r => r.id === deleteTarget.id)
        if (recording?.storage_path) {
          const pathParts = recording.storage_path.split('/')
          const bucket = pathParts[0]
          const filePath = pathParts.slice(1).join('/')
          const { error: storageError } = await supabase.storage
            .from(bucket)
            .remove([filePath])
          if (storageError) {
            console.warn('Error deleting recording from storage:', storageError)
          }
        }

        const { error } = await supabase
          .from('event_recordings')
          .delete()
          .eq('id', deleteTarget.id)
          .eq('community_id', community.id)

        if (error) throw error
        toast.success("Recording deleted successfully")
      } else {
        const upload = uploadedVideos.find((video) => video.id === deleteTarget.id)
        if (upload?.storage_path) {
          const pathParts = String(upload.storage_path).split('/')
          const bucket = pathParts[0]
          const filePath = pathParts.slice(1).join('/')
          const { error: storageError } = await supabase.storage
            .from(bucket)
            .remove([filePath])

          if (storageError) {
            console.warn('Error deleting uploaded video from storage:', storageError)
          }
        }

        const { error } = await supabase
          .from('uploaded_videos')
          .delete()
          .eq('id', deleteTarget.id)
          .eq('community_id', community.id)

        if (error) throw error
        toast.success("Uploaded video deleted successfully")
      }

      setDeleteDialogOpen(false)
      setDeleteTarget(null)
      router.refresh()
    } catch (error: any) {
      console.error('Error deleting video:', error)
      toast.error(error.message || "Failed to delete video")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        {/* Navigation Tabs */}
        <CommunityNavigation 
          slug={community.slug} 
          isOwner={isOwner} 
          isMember={isMember} 
        />

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "recordings" | "uploads")}
          className="space-y-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="grid w-full grid-cols-2 border border-white/20 bg-white/5 text-white/70 sm:w-auto sm:min-w-[240px]">
              <TabsTrigger
                value="recordings"
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white"
              >
                Recordings
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] leading-none text-white/70">
                  {recordings.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="uploads"
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white"
              >
                Uploads
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] leading-none text-white/70">
                  {uploadedVideos.length}
                </span>
              </TabsTrigger>
            </TabsList>
            {isOwner && (
              <Button
                onClick={() => handleUploadDialogChange(true)}
                variant="outline"
                className="w-full border-white/20 bg-white/10 text-white hover:bg-white/20 sm:w-auto"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Video
              </Button>
            )}
          </div>

          <TabsContent value="recordings" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
            {hasRecordings ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {recordings.map((recording) => {
                  const recordingDuration = formatDuration(recording.duration_seconds)
                  return (
                    <Card
                      key={recording.id}
                      className="group overflow-hidden border-0 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md transition-all duration-300 hover:from-white/15 hover:shadow-lg hover:shadow-white/10"
                    >
                      <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-white/5 to-white/10">
                        <SecureVideoCard
                          communityId={recording.community_id ?? community.id}
                          item={{
                            id: recording.id,
                            title:
                              recording.title ||
                              recording.event?.description ||
                              `Recording ${formatDate(recording.created_at)}`,
                            type: "Recording",
                            sourceType: "recording",
                            sourceId: String(recording.id),
                            storagePath: recording.storage_path ?? null,
                            fallbackUrl:
                              recording.stream_recording_url ||
                              recording.storage_url ||
                              null,
                            createdAt: recording.created_at ?? null,
                            description: recording.description ?? recording.event?.description ?? null,
                            communityId: recording.community_id ?? community.id,
                          } satisfies CarouselItem}
                        />
                        <div className="absolute right-3 top-3 z-10">
                          {recording.is_processing ? (
                            <Badge className="backdrop-blur-sm border-yellow-500/30 bg-yellow-500/20 text-yellow-400">
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              Processing
                            </Badge>
                          ) : recording.storage_url ? (
                            <Badge className="backdrop-blur-sm border-green-500/30 bg-green-500/20 text-green-400">
                              Saved
                            </Badge>
                          ) : (
                            <Badge className="backdrop-blur-sm border-blue-500/30 bg-blue-500/20 text-blue-400">
                              Available
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="mb-2 line-clamp-2 text-lg font-semibold text-white transition-colors group-hover:text-white/90">
                              {recording.title || recording.event?.description || `Recording ${formatDate(recording.created_at)}`}
                            </CardTitle>
                            <div className="flex items-center gap-2 text-sm text-white/60">
                              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{formatDate(recording.created_at)}</span>
                            </div>
                          </div>
                          {isOwner && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center p-0 text-white/60 hover:bg-white/10 hover:text-white"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="border-white/20 bg-black/90 backdrop-blur-md">
                                <DropdownMenuItem
                                  onClick={() => handleDownloadRecording(recording)}
                                  className="text-white hover:bg-white/10"
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  Download
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-white/20" />
                                <DropdownMenuItem
                                  onClick={() => openDeleteDialog({ id: recording.id, type: "recording" })}
                                  className="text-red-400 hover:bg-red-500/20"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-0">
                        <div className="space-y-2.5">
                          {recording.event && (
                            <div className="flex items-center gap-2 text-sm text-white/70">
                              <Video className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">Event: {formatDate(recording.event.scheduled_at)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-sm text-white/60">
                            <span className="font-medium">{formatFileSize(recording.file_size_bytes)}</span>
                            {recordingDuration && (
                              <span className="text-white/50">{recordingDuration}</span>
                            )}
                          </div>
                        </div>
                        {!recording.storage_url && !recording.stream_recording_url && (
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="default"
                              disabled
                              className="w-full cursor-not-allowed gap-2 border-white/20 bg-white/5 text-white/70"
                            >
                              <Loader2 className="h-4 w-4 animate-spin text-white/80" />
                              Processing...
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card className="border-0 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md">
                <CardContent className="space-y-4 p-12 text-center">
                  <FileVideo className="mx-auto h-10 w-10 text-white/40" />
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-white">No Recordings Yet</h3>
                    <p className="text-white/60">
                      Recordings from your community events will appear here after your live sessions end.
                    </p>
                  </div>
                  <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10">
                    <Link href={`/${community.slug}/events`}>
                      <Calendar className="mr-2 h-4 w-4" />
                      View Events
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="uploads" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
            {hasUploadedVideos ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {uploadedVideos.map((video) => {
                  const uploadDuration = formatDuration(video.duration_seconds)
                  return (
                    <Card
                      key={video.id}
                      className="group overflow-hidden border-0 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md transition-all duration-300 hover:from-white/15 hover:shadow-lg hover:shadow-white/10"
                    >
                      <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-white/5 to-white/10">
                        <SecureVideoCard
                          communityId={video.community_id ?? community.id}
                          item={{
                            id: video.id,
                            title: video.title || `Upload ${formatDate(video.created_at)}`,
                            type: "Upload",
                            sourceType: "upload",
                            sourceId: String(video.id),
                            storagePath: video.storage_path ?? null,
                            fallbackUrl: video.storage_url ?? null,
                            createdAt: video.created_at ?? null,
                            description: video.description ?? null,
                            communityId: video.community_id ?? community.id,
                          } satisfies CarouselItem}
                        />
                        <div className="absolute right-3 top-3 z-10">
                          {(isOwner || video.storage_url) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center p-0 text-white/60 hover:bg-white/10 hover:text-white"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="border-white/20 bg-black/90 backdrop-blur-md">
                                <DropdownMenuItem
                                  onClick={() => handleDownloadUploadedVideo(video)}
                                  className="text-white hover:bg-white/10"
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  Download
                                </DropdownMenuItem>
                                {isOwner && (
                                  <>
                                    <DropdownMenuSeparator className="bg-white/20" />
                                    <DropdownMenuItem
                                      onClick={() => openDeleteDialog({ id: video.id as string, type: "upload" })}
                                      className="text-red-400 hover:bg-red-500/20"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="mb-2 line-clamp-2 text-lg font-semibold text-white transition-colors group-hover:text-white/90">
                              {video.title || `Upload ${formatDate(video.created_at)}`}
                            </CardTitle>
                            <div className="flex items-center gap-2 text-sm text-white/60">
                              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{formatDate(video.created_at)}</span>
                            </div>
                          </div>
                          {(isOwner || video.storage_url) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center p-0 text-white/60 hover:bg-white/10 hover:text-white"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="border-white/20 bg-black/90 backdrop-blur-md">
                                <DropdownMenuItem
                                  onClick={() => handleDownloadUploadedVideo(video)}
                                  className="text-white hover:bg-white/10"
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  Download
                                </DropdownMenuItem>
                                {isOwner && (
                                  <>
                                    <DropdownMenuSeparator className="bg-white/20" />
                                    <DropdownMenuItem
                                      onClick={() => openDeleteDialog({ id: video.id as string, type: "upload" })}
                                      className="text-red-400 hover:bg-red-500/20"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-0">
                        {video.description && (
                          <p className="line-clamp-3 text-sm text-white/70">{video.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-white/60">
                          <span className="font-medium">{formatFileSize(video.file_size_bytes ?? 0)}</span>
                          {uploadDuration && (
                            <span className="text-white/50">{uploadDuration}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card className="border-0 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md">
                <CardContent className="space-y-4 p-12 text-center">
                  <Upload className="mx-auto h-10 w-10 text-white/40" />
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-white">No Uploaded Videos</h3>
                    <p className="text-white/60">
                      Upload pre-recorded videos to share with your community members at any time.
                    </p>
                  </div>
                  {isOwner && (
                    <Button
                      onClick={() => handleUploadDialogChange(true)}
                      variant="outline"
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Video
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Upload Video Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={handleUploadDialogChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Upload Video</DialogTitle>
            <DialogDescription className="text-white/60">
              Share pre-recorded content with your community. Supported formats include MP4, WebM, and MOV.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="upload-video-title" className="text-white/80">
                Title
              </Label>
              <Input
                id="upload-video-title"
                value={uploadTitle}
                onChange={(event) => setUploadTitle(event.target.value)}
                placeholder="Add a title for your video"
                className="border-white/20 bg-white/5 text-white placeholder:text-white/40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-video-description" className="text-white/80">
                Description (optional)
              </Label>
              <Textarea
                id="upload-video-description"
                value={uploadDescription}
                onChange={(event) => setUploadDescription(event.target.value)}
                placeholder="Tell your community what this video covers"
                className="min-h-[100px] border-white/20 bg-white/5 text-white placeholder:text-white/40"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="upload-video-file" className="text-white/80">
                Video file
              </Label>
              <Input
                ref={fileInputRef}
                id="upload-video-file"
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                onChange={handleFileChange}
                className="hidden"
              />
              {uploadFile ? (
                <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-white">{uploadFile.name}</p>
                      <p className="text-xs text-white/60">{formatFileSize(uploadFile.size)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 sm:pt-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation()
                          triggerFilePicker()
                        }}
                        className="border-white/20 text-white hover:bg-white/10"
                      >
                        Change video
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearSelectedFile}
                        className="text-white/70 hover:text-white"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={triggerFilePicker}
                    onKeyDown={handleFilePickerKeyDown}
                    className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-white/20 bg-white/5 px-6 py-8 text-center text-white/70 transition hover:border-white/30 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
                  >
                    <Upload className="h-6 w-6 text-white/70" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-white">Click to choose a video</p>
                      <p className="text-xs text-white/60">MP4, WebM or MOV videos up to 500 MB.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation()
                        triggerFilePicker()
                      }}
                      className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                    >
                      Browse files
                    </Button>
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Tip: Keep uploads under your available storage to avoid interruptions.
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4 flex justify-end">
            <Button
              type="button"
              onClick={handleUploadSubmit}
              disabled={isUploading || !uploadFile}
              className="bg-white/10 text-white hover:bg-white/20"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Video
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {deleteTarget?.type === "upload" ? "Delete Uploaded Video" : "Delete Recording"}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              {deleteTarget?.type === "upload"
                ? "This will permanently remove the uploaded video and free up the associated storage."
                : "This will permanently remove the recording from your community library."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => handleDeleteDialogChange(false)}
              disabled={isDeleting}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

