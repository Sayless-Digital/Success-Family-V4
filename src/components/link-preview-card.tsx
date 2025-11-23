"use client"

import { X, ExternalLink, Loader2 } from "lucide-react"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { LinkPreview } from "@/app/api/link-preview/route"

interface LinkPreviewCardProps {
  preview: LinkPreview | null
  loading?: boolean
  onRemove?: () => void
  className?: string
  compact?: boolean
}

export function LinkPreviewCard({
  preview,
  loading = false,
  onRemove,
  className,
  compact = false,
}: LinkPreviewCardProps) {
  if (loading) {
    return (
      <Card className={cn(
        "border-white/20 bg-white/10 p-3",
        compact && "p-2",
        className
      )}>
        <div className="flex gap-3 animate-pulse">
          {!compact && (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-white/10 flex-shrink-0" />
          )}
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-white/10 rounded w-3/4" />
            <div className="h-3 bg-white/10 rounded w-full" />
            <div className="h-3 bg-white/10 rounded w-2/3" />
            {!compact && (
              <div className="h-3 bg-white/10 rounded w-1/2" />
            )}
          </div>
        </div>
      </Card>
    )
  }

  if (!preview) return null

  const hasImage = preview.image && !compact

  return (
    <Card className={cn(
      "border-white/20 bg-white/10 p-3 group relative",
      compact && "p-2",
      className
    )}>
      <div className="flex gap-3">
        {hasImage && preview.image && (
          <a
            href={preview.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border border-white/20 bg-white/5 relative"
          >
            <Image
              src={preview.image}
              alt={preview.title || "Preview"}
              fill
              className="object-cover"
              sizes="96px"
              onError={(e) => {
                // Hide image if it fails to load
                e.currentTarget.style.display = "none"
              }}
            />
          </a>
        )}
        
        <div className="flex-1 min-w-0">
          {preview.title && (
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="block mb-1 group/link"
            >
              <h4 className={cn(
                "text-white/90 font-medium line-clamp-2 hover:text-white transition-colors",
                compact ? "text-sm" : "text-base"
              )}>
                {preview.title}
              </h4>
            </a>
          )}
          
          {preview.description && (
            <p className={cn(
              "text-white/60 line-clamp-2 mb-1.5",
              compact ? "text-xs" : "text-sm"
            )}>
              {preview.description}
            </p>
          )}
          
          <div className="flex items-center gap-2 mt-1">
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "text-white/50 hover:text-white/70 transition-colors flex items-center gap-1",
                compact ? "text-xs" : "text-sm"
              )}
            >
              <span className="truncate max-w-[200px]">
                {preview.siteName || new URL(preview.url).hostname.replace(/^www\./, "")}
              </span>
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          </div>
        </div>
        
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="absolute top-2 right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </Card>
  )
}




