"use client"

import * as React from "react"
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, RotateCw } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PostMedia } from "@/types"

interface PostMediaLightboxProps {
  media: PostMedia[]
  imageUrls: Record<string, string>
  initialIndex: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PostMediaLightbox({
  media,
  imageUrls,
  initialIndex,
  open,
  onOpenChange
}: PostMediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex)
  const [scale, setScale] = React.useState(1)
  const [position, setPosition] = React.useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 })
  const imageRef = React.useRef<HTMLImageElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Sort media by display_order
  const sortedMedia = React.useMemo(() => {
    return [...media].sort((a, b) => a.display_order - b.display_order)
  }, [media])

  // Update currentIndex when initialIndex changes (when opening with a different image)
  React.useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex)
      setScale(1)
      setPosition({ x: 0, y: 0 })
    }
  }, [open, initialIndex])

  // Reset zoom when image changes (from navigation within dialog)
  React.useEffect(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [currentIndex])


  const currentMedia = sortedMedia[currentIndex]
  const currentImageUrl = currentMedia ? imageUrls[currentMedia.id] : null

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 5))
  }

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5))
  }

  const handleResetZoom = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setScale(prev => Math.max(0.5, Math.min(5, prev + delta)))
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (scale > 1 && e.touches.length === 1) {
      setIsDragging(true)
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && scale > 1 && e.touches.length === 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      })
    }
  }

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % sortedMedia.length)
  }

  const handlePrevious = () => {
    setCurrentIndex(prev => (prev - 1 + sortedMedia.length) % sortedMedia.length)
  }

  // Keyboard navigation
  React.useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentIndex(prev => (prev - 1 + sortedMedia.length) % sortedMedia.length)
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex(prev => (prev + 1) % sortedMedia.length)
      } else if (e.key === 'Escape') {
        onOpenChange(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, sortedMedia.length, onOpenChange])

  if (!currentImageUrl) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="!max-w-[95vw] !max-h-[95dvh] !w-[95vw] !h-[95dvh] !top-[2.5dvh] !left-[2.5vw] !right-auto !bottom-auto !translate-x-0 !translate-y-0 p-0 border-0 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md !overflow-hidden">
        {/* Visually Hidden Title for Accessibility */}
        <DialogTitle className="sr-only">
          Post Image {currentIndex + 1} of {sortedMedia.length}
        </DialogTitle>
        
        {/* Custom Close Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-50 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 border border-white/20 text-white backdrop-blur-sm"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Zoom Controls */}
        <div className="absolute left-4 top-4 z-50 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 border border-white/20 text-white backdrop-blur-sm disabled:opacity-50"
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            disabled={scale >= 5}
            className="h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 border border-white/20 text-white backdrop-blur-sm disabled:opacity-50"
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
          {scale !== 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleResetZoom}
              className="h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 border border-white/20 text-white backdrop-blur-sm"
            >
              <RotateCw className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Image Counter */}
        {sortedMedia.length > 1 && (
          <div className="absolute left-1/2 bottom-4 z-50 -translate-x-1/2 px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 text-white text-sm">
            {currentIndex + 1} / {sortedMedia.length}
          </div>
        )}

        {/* Navigation Buttons */}
        {sortedMedia.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-50 h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 border border-white/20 text-white backdrop-blur-sm"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-50 h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 border border-white/20 text-white backdrop-blur-sm"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}

        {/* Image Container */}
        <div
          ref={containerRef}
          className="flex items-center justify-center w-full h-full overflow-hidden cursor-move"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
          style={{
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
          }}
        >
          <img
            ref={imageRef}
            src={currentImageUrl}
            alt={currentMedia?.file_name || 'Post image'}
            className={cn(
              "max-w-full max-h-full object-contain select-none transition-transform duration-200",
              scale > 1 && "select-none"
            )}
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transformOrigin: 'center center'
            }}
            draggable={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

