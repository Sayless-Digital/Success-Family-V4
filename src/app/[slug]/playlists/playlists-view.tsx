"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { ListMusic, Plus } from "lucide-react"
import { toast } from "sonner"
import { CommunityNavigation } from "@/components/community-navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { TooltipProvider } from "@/components/ui/tooltip"
import { PlaylistCard } from "@/app/[slug]/playlists/components/playlist-card"
import { PlaylistDeleteDialog } from "@/app/[slug]/playlists/components/playlist-delete-dialog"
import { PlaylistEditorDialog } from "@/app/[slug]/playlists/components/playlist-editor-dialog"
import type { DialogState, PlaylistWithItems } from "@/app/[slug]/playlists/types"
import type { Community, EventRecording, UploadedVideo } from "@/types"

interface CommunityPlaylistsViewProps {
  community: Community
  playlists: PlaylistWithItems[]
  recordings: EventRecording[]
  uploadedVideos: UploadedVideo[]
  isOwner: boolean
  isMember: boolean
  currentUserId?: string
}

export default function CommunityPlaylistsView({
  community,
  playlists,
  recordings,
  uploadedVideos,
  isOwner,
  isMember,
}: CommunityPlaylistsViewProps) {
  const router = useRouter()
  const [dialogState, setDialogState] = useState<DialogState>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlaylistWithItems | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const canManage = isOwner
  const playlistsToRender = playlists ?? []
  const hasPlaylists = playlistsToRender.length > 0

  const handleOpenCreate = useCallback(() => setDialogState({ mode: "create" }), [])

  const handleOpenEdit = useCallback((playlist: PlaylistWithItems) => {
    setDialogState({ mode: "edit", playlist })
  }, [])

  const handleCloseDialog = useCallback(() => {
    setDialogState(null)
  }, [])

  const handleDialogSaved = useCallback(() => {
    router.refresh()
  }, [router])

  const handleDeleteRequest = useCallback((playlist: PlaylistWithItems) => {
    setDeleteTarget(playlist)
  }, [])

  const handleDeleteCancel = useCallback(() => {
    setDeleteTarget(null)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/playlists/${deleteTarget.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error || "Failed to delete playlist")
      }

      toast.success("Playlist deleted")
      setDeleteTarget(null)
      router.refresh()
    } catch (error: unknown) {
      console.error("[Playlists UI] Failed to delete playlist:", error)
      if (error instanceof Error) {
        toast.error(error.message || "Failed to delete playlist")
      } else {
        toast.error("Failed to delete playlist")
      }
    } finally {
      setIsDeleting(false)
    }
  }, [deleteTarget, router])

  return (
    <TooltipProvider>
      <div className="relative w-full overflow-x-hidden">
        <div className="relative z-10 space-y-6">
        <CommunityNavigation 
          slug={community.slug} 
          isOwner={isOwner} 
          isMember={isMember}
          communityOwnerId={community.owner_id}
        />

        <div className="flex justify-end">
          {canManage && (
              <Button onClick={handleOpenCreate} variant="outline" className="w-full gap-2 sm:w-auto">
              <Plus className="h-4 w-4 text-white/80" />
              Create Playlist
            </Button>
          )}
        </div>

        {hasPlaylists ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {playlistsToRender.map((playlist) => (
                <PlaylistCard
                key={playlist.id}
                  playlist={playlist}
                  canManage={canManage}
                  onEdit={handleOpenEdit}
                  onDelete={handleDeleteRequest}
                    />
            ))}
          </div>
        ) : (
          <Card className="border-0 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md">
            <CardContent className="space-y-4 p-12 text-center">
              <ListMusic className="mx-auto h-10 w-10 text-white/40" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">No playlists yet</h3>
                <p className="text-white/60">
                  Curate your recordings and uploads into collections to guide members through your content.
                </p>
              </div>
              {canManage && (
                  <Button onClick={handleOpenCreate} variant="outline" className="border-white/20 text-white hover:bg-white/10">
                  <Plus className="mr-2 h-4 w-4 text-white/80" />
                  Create your first playlist
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

        <PlaylistEditorDialog
          community={community}
          dialogState={dialogState}
          recordings={recordings}
          uploadedVideos={uploadedVideos}
          onClose={handleCloseDialog}
          onSaved={handleDialogSaved}
        />

        <PlaylistDeleteDialog
          open={!!deleteTarget}
          playlist={deleteTarget}
          isDeleting={isDeleting}
          onCancel={handleDeleteCancel}
          onConfirm={handleConfirmDelete}
        />
    </div>
    </TooltipProvider>
  )
}

