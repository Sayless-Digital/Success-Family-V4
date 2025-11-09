"use client"

import { CheckCircle2, Clock, ListMusic, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PlaylistMediaCarousel } from "@/app/[slug]/playlists/components/playlist-media-carousel"
import type { PlaylistWithItems } from "@/app/[slug]/playlists/types"
import { formatDate } from "@/app/[slug]/playlists/utils"

interface PlaylistCardProps {
  playlist: PlaylistWithItems
  canManage: boolean
  onEdit: (playlist: PlaylistWithItems) => void
  onDelete: (playlist: PlaylistWithItems) => void
}

export function PlaylistCard({ playlist, canManage, onEdit, onDelete }: PlaylistCardProps) {
  return (
    <Card className="group border-0 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-xl transition-all duration-300 hover:from-white/15 hover:shadow-lg hover:shadow-white/10">
      <CardHeader className="px-6 pt-6 pb-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <CardTitle className="text-xl font-semibold text-white sm:text-[1.35rem]">{playlist.title}</CardTitle>
              {playlist.description ? (
                <CardDescription className="text-sm text-white/70 sm:text-base">{playlist.description}</CardDescription>
              ) : null}
            </div>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/70 transition hover:border-white/30 hover:bg-white/10 hover:text-white sm:h-9 sm:w-9"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => onEdit(playlist)} className="flex items-center gap-2 text-white hover:bg-white/10">
                    <Pencil className="h-4 w-4 text-white/70" />
                    Edit playlist
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/20" />
                  <DropdownMenuItem
                    onClick={() => onDelete(playlist)}
                    className="flex items-center gap-2 text-red-400 hover:bg-red-500/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/60 sm:text-sm sm:text-white/70">
            <Badge className="flex items-center gap-1 bg-white/10 text-white/80">
              {playlist.status === "published" ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-white/70" />
                  Published
                </>
              ) : (
                <>
                  <Clock className="h-3.5 w-3.5 text-white/70" />
                  Draft
                </>
              )}
            </Badge>
            <span className="text-white/60">Updated {formatDate(playlist.updated_at)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-6 pb-6">
        {playlist.items && playlist.items.length > 0 ? (
          <PlaylistMediaCarousel
            playlistId={playlist.id}
            items={playlist.items
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((item, index) => {
                const isRecording = Boolean(item.event_recording)
                const recording = item.event_recording ?? null
                const upload = item.uploaded_video ?? null
                const title = isRecording
                  ? recording?.title || recording?.event?.description || `Recording ${index + 1}`
                  : upload?.title || `Upload ${index + 1}`
                const storagePath = recording?.storage_path ?? upload?.storage_path ?? null
                const fallbackUrl =
                  recording?.stream_recording_url ??
                  recording?.storage_url ??
                  upload?.storage_url ??
                  null

                return {
                  id: item.id,
                  title,
                  type: isRecording ? "Recording" : "Upload",
                  sourceType: isRecording ? "recording" : "upload",
                  sourceId: String(isRecording ? recording?.id ?? "" : upload?.id ?? ""),
                  storagePath,
                  fallbackUrl,
                  createdAt: recording?.created_at ?? upload?.created_at ?? null,
                  description: recording?.description ?? upload?.description ?? null,
                  communityId:
                    recording?.community_id ??
                    upload?.community_id ??
                    playlist.community_id,
                }
              })}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/5/60 p-8 text-center text-white/60">
            No items yet. {canManage ? "Add recordings or uploads to this playlist." : ""}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/60 sm:text-sm sm:text-white/70">
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs sm:text-sm">
            <ListMusic className="h-4 w-4 text-white/70" />
            <span>
              {playlist.items?.length ?? 0} item{playlist.items && playlist.items.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
            <Clock className="h-4 w-4 text-white/70" />
            <span>Updated {formatDate(playlist.updated_at)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

