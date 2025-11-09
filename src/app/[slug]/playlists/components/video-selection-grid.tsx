"use client"

import { formatDate, formatDuration, formatFileSize } from "@/app/[slug]/playlists/utils"
import type { PlaylistSourceOption } from "@/app/[slug]/playlists/types"
import { cn } from "@/lib/utils"

interface VideoSelectionGridProps {
  options: PlaylistSourceOption[]
  selectedLookup: Set<string>
  selectionOrderLookup: Map<string, number>
  onToggle: (option: PlaylistSourceOption) => void
  emptyMessage: string
}

export function VideoSelectionGrid({
  options,
  selectedLookup,
  selectionOrderLookup,
  onToggle,
  emptyMessage,
}: VideoSelectionGridProps) {
  if (!options.length) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="grid gap-6 px-1 pb-2 pt-1 sm:grid-cols-2">
      {options.map((option) => {
        const key = `${option.sourceType}:${option.id}`
        const isSelected = selectedLookup.has(key)
        const selectionOrder = selectionOrderLookup.get(key)

        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(option)}
            className={cn(
              "space-y-3 rounded-xl border border-white/15 bg-white/5 p-4 text-left transition hover:border-white/30",
              isSelected && "border-white/40 bg-white/10",
            )}
          >
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black/80">
              {option.previewUrl ? (
                <video
                  src={option.previewUrl}
                  controls
                  preload="metadata"
                  className="h-full w-full object-cover"
                  controlsList="nodownload"
                  disablePictureInPicture
                  onContextMenu={(event) => event.preventDefault()}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-white/60">
                  Preview unavailable
                </div>
              )}
              {selectionOrder ? (
                <div className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">
                  #{selectionOrder}
                </div>
              ) : null}
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="line-clamp-2 text-sm font-semibold text-white">{option.title}</p>
                <div className="flex flex-wrap gap-2 text-xs text-white/60">
                  {option.createdAt && <span>{formatDate(option.createdAt)}</span>}
                  {formatDuration(option.durationSeconds) && <span>{formatDuration(option.durationSeconds)}</span>}
                  {formatFileSize(option.fileSizeBytes) && <span>{formatFileSize(option.fileSizeBytes)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectionOrder ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white">
                    {selectionOrder}
                  </span>
                ) : null}
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border border-white/30",
                    isSelected ? "bg-white text-black" : "bg-transparent text-white/70",
                  )}
                >
                  {isSelected ? "✓" : ""}
                </span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

