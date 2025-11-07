"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Video, Calendar, Download, Trash2, MoreVertical, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CommunityNavigation } from "@/components/community-navigation"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import type { EventRecording } from "@/types"

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

interface CommunityRecordingsViewProps {
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
  currentUserId?: string
}

export default function CommunityRecordingsView({ 
  community, 
  recordings,
  isOwner,
  currentUserId 
}: CommunityRecordingsViewProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [recordingToDelete, setRecordingToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!recordingToDelete || !isOwner) return

    setIsDeleting(true)
    try {
      // Delete from storage first if path exists
      const recording = recordings.find(r => r.id === recordingToDelete)
      if (recording?.storage_path) {
        const pathParts = recording.storage_path.split('/')
        const bucket = pathParts[0]
        const filePath = pathParts.slice(1).join('/')
        
        const { error: storageError } = await supabase.storage
          .from(bucket)
          .remove([filePath])
        
        if (storageError) {
          console.warn('Error deleting from storage:', storageError)
          // Continue with DB deletion even if storage deletion fails
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('event_recordings')
        .delete()
        .eq('id', recordingToDelete)
        .eq('community_id', community.id)

      if (error) throw error

      toast.success("Recording deleted successfully")
      setDeleteDialogOpen(false)
      setRecordingToDelete(null)
      // Use router.refresh() instead of window.location.reload() to avoid full page refresh
      router.refresh()
    } catch (error: any) {
      console.error('Error deleting recording:', error)
      toast.error(error.message || "Failed to delete recording")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDownload = async (recording: EventRecording) => {
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

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        {/* Navigation Tabs */}
        <CommunityNavigation 
          slug={community.slug} 
          isOwner={isOwner} 
          isMember={false} 
        />

        {/* Recordings List */}
        {recordings.length === 0 ? (
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardContent className="p-12 text-center">
              <h3 className="text-xl font-semibold text-white mb-2">No Recordings Yet</h3>
              <p className="text-white/60 mb-6">
                Recordings from your community events will appear here.
              </p>
              <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10">
                <Link href={`/${community.slug}/events`}>
                  <Calendar className="h-4 w-4 mr-2" />
                  View Events
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recordings.map((recording) => (
              <Card 
                key={recording.id} 
                className="group bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 hover:from-white/15 hover:shadow-lg hover:shadow-white/10 transition-all duration-300 overflow-hidden"
              >
                {/* Video Player Area */}
                <div className="relative w-full h-48 bg-gradient-to-br from-white/5 to-white/10 overflow-hidden">
                  {(recording.storage_url || recording.stream_recording_url) ? (
                    <video
                      src={recording.storage_url || recording.stream_recording_url || undefined}
                      className="w-full h-full object-cover"
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <>
                      {/* Overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    </>
                  )}
                  
                  {/* Status Badge - Top Right */}
                  <div className="absolute top-3 right-3 z-10">
                    {recording.is_processing ? (
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 backdrop-blur-sm">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Processing
                      </Badge>
                    ) : recording.storage_url ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 backdrop-blur-sm">
                        Saved
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 backdrop-blur-sm">
                        Available
                      </Badge>
                    )}
                  </div>
                </div>

                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-white text-lg font-semibold mb-2 line-clamp-2 group-hover:text-white/90 transition-colors">
                        {recording.title || recording.event?.description || `Recording ${formatDate(recording.created_at)}`}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-white/60 text-sm">
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
                            className="h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10 flex-shrink-0"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-black/90 backdrop-blur-md border-white/20">
                          <DropdownMenuItem 
                            onClick={() => handleDownload(recording)}
                            className="text-white hover:bg-white/10"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/20" />
                          <DropdownMenuItem 
                            onClick={() => {
                              setRecordingToDelete(recording.id)
                              setDeleteDialogOpen(true)
                            }}
                            className="text-red-400 hover:bg-red-500/20"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4 pt-0">
                  {/* Recording Metadata */}
                  <div className="space-y-2.5">
                    {recording.event && (
                      <div className="flex items-center gap-2 text-white/70 text-sm">
                        <Video className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">Event: {formatDate(recording.event.scheduled_at)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-white/60 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{formatFileSize(recording.file_size_bytes)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Processing State */}
                  {!recording.storage_url && !recording.stream_recording_url && (
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="default"
                        disabled
                        className="w-full gap-2 bg-white/5 border-white/20 text-white/70 cursor-not-allowed"
                      >
                        <Loader2 className="h-4 w-4 animate-spin text-white/80" />
                        Processing...
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-black/90 backdrop-blur-md border-white/20">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Recording</DialogTitle>
            <DialogDescription className="text-white/60">
              Are you sure you want to delete this recording? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
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

