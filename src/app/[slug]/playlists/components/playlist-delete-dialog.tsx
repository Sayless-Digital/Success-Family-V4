"use client"

import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { PlaylistWithItems } from "@/app/[slug]/playlists/types"

interface PlaylistDeleteDialogProps {
  open: boolean
  playlist: PlaylistWithItems | null
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function PlaylistDeleteDialog({ open, playlist, isDeleting, onCancel, onConfirm }: PlaylistDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? onCancel() : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Delete playlist</DialogTitle>
          <DialogDescription className="text-white/60">
            This will permanently remove the playlist{" "}
            <span className="font-semibold text-white">{playlist?.title}</span> and all of its items. This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting} className="sm:w-auto">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}




