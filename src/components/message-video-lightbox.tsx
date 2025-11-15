"use client"

import * as React from "react"
import { X, ChevronLeft, ChevronRight, Play, Pause, Maximize, Minimize } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MessageVideoLightboxProps {
  videos: Array<{ id: string; url: string }>
  initialIndex: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MessageVideoLightbox({
  videos,
  initialIndex,
  open,
  onOpenChange
}: MessageVideoLightboxProps) {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex)
  const [playing, setPlaying] = React.useState(false)
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const videoRef = React.useRef<HTMLVideoElement>(null)

  // Update currentIndex when initialIndex changes (when opening with a different video)
  React.useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex)
      setPlaying(false)
      // Auto-play when lightbox opens
      if (videoRef.current) {
        const playPromise = videoRef.current.play()
        if (playPromise !== undefined) {
          playPromise
            .then(() => setPlaying(true))
            .catch(() => setPlaying(false))
        }
      }
    }
  }, [open, initialIndex])

  // Reset playing state when video changes (from navigation within dialog)
  React.useEffect(() => {
    if (videoRef.current) {
      setPlaying(false)
      videoRef.current.pause()
      videoRef.current.currentTime = 0
      // Auto-play new video after a short delay
      const timer = setTimeout(() => {
        if (videoRef.current) {
          const playPromise = videoRef.current.play()
          if (playPromise !== undefined) {
            playPromise
              .then(() => setPlaying(true))
              .catch(() => setPlaying(false))
          }
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [currentIndex])

  const currentVideo = videos[currentIndex]

  const handlePlayPause = React.useCallback(() => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause()
        setPlaying(false)
      } else {
        const playPromise = videoRef.current.play()
        if (playPromise !== undefined) {
          playPromise
            .then(() => setPlaying(true))
            .catch(() => setPlaying(false))
        }
      }
    }
  }, [playing])

  const handleNext = React.useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % videos.length)
  }, [videos.length])

  const handlePrevious = React.useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + videos.length) % videos.length)
  }, [videos.length])

  const handleVideoEnded = () => {
    setPlaying(false)
    if (videoRef.current) {
      videoRef.current.currentTime = 0
    }
  }

  const handleVideoPlay = () => {
    setPlaying(true)
  }

  const handleVideoPause = () => {
    setPlaying(false)
  }

  // Handle fullscreen toggle
  const handleFullscreenToggle = React.useCallback(() => {
    if (!videoRef.current) return

    const video = videoRef.current
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    )

    if (isCurrentlyFullscreen) {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(console.error)
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen()
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen()
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen()
      }
    } else {
      // Enter fullscreen
      if (video.requestFullscreen) {
        video.requestFullscreen().catch(console.error)
      } else if ((video as any).webkitRequestFullscreen) {
        (video as any).webkitRequestFullscreen()
      } else if ((video as any).mozRequestFullScreen) {
        (video as any).mozRequestFullScreen()
      } else if ((video as any).msRequestFullscreen) {
        (video as any).msRequestFullscreen()
      }
    }
  }, [])

  // Handle dialog close - prevent closing when in fullscreen
  const handleDialogOpenChange = React.useCallback((isOpen: boolean) => {
    // Only close dialog if not in fullscreen mode
    if (!isOpen && !isFullscreen) {
      onOpenChange(false)
    }
  }, [isFullscreen, onOpenChange])

  // Keyboard navigation
  React.useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if in fullscreen mode first
      const inFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      )

      if (e.key === 'ArrowLeft') {
        if (!inFullscreen) {
          handlePrevious()
        }
      } else if (e.key === 'ArrowRight') {
        if (!inFullscreen) {
          handleNext()
        }
      } else if (e.key === 'Escape') {
        // If in fullscreen, exit fullscreen first
        if (inFullscreen) {
          e.preventDefault()
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(console.error)
          } else if ((document as any).webkitExitFullscreen) {
            (document as any).webkitExitFullscreen()
          } else if ((document as any).mozCancelFullScreen) {
            (document as any).mozCancelFullScreen()
          } else if ((document as any).msExitFullscreen) {
            (document as any).msExitFullscreen()
          }
        } else {
          // Only close dialog if not in fullscreen
          onOpenChange(false)
        }
      } else if (e.key === ' ' && !inFullscreen) {
        e.preventDefault()
        handlePlayPause()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, videos.length, onOpenChange, handlePrevious, handleNext, handlePlayPause])

  // Monitor fullscreen state changes
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      const inFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      )
      
      setIsFullscreen(inFullscreen)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    }
  }, [])

  // Cleanup on close
  React.useEffect(() => {
    if (!open && videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
      setPlaying(false)
    }
  }, [open])

  if (!currentVideo) return null

  return (
    <Dialog 
      open={open} 
      onOpenChange={handleDialogOpenChange}
    >
      <DialogContent 
        hideCloseButton 
        className="!max-w-[95vw] !max-h-[95dvh] !w-[95vw] !h-[95dvh] !top-[2.5dvh] !left-[2.5vw] !right-auto !bottom-auto !translate-x-0 !translate-y-0 p-0 border-0 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md !overflow-hidden"
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement
          // Prevent closing when clicking video controls (especially fullscreen button)
          if (target?.closest('video') || target?.closest('[data-sonner-toaster]')) {
            event.preventDefault()
          }
          // Also prevent closing when in fullscreen mode
          const inFullscreen = !!(
            document.fullscreenElement ||
            (document as any).webkitFullscreenElement ||
            (document as any).mozFullScreenElement ||
            (document as any).msFullscreenElement
          )
          if (inFullscreen) {
            event.preventDefault()
          }
        }}
      >
        {/* Visually Hidden Dialog Header for Accessibility */}
        <DialogHeader className="sr-only">
          <DialogTitle>Message video {currentIndex + 1} of {videos.length}</DialogTitle>
          <DialogDescription>Use arrow keys or on-screen controls to navigate through videos. Press spacebar to play/pause.</DialogDescription>
        </DialogHeader>
        
        {/* Custom Close Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-50 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 border border-white/20 text-white backdrop-blur-sm"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Custom Fullscreen Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleFullscreenToggle}
          className="absolute right-4 top-16 z-50 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 border border-white/20 text-white backdrop-blur-sm"
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? (
            <Minimize className="h-5 w-5" />
          ) : (
            <Maximize className="h-5 w-5" />
          )}
        </Button>

        {/* Video Counter */}
        {videos.length > 1 && (
          <div className="absolute left-1/2 top-4 z-50 -translate-x-1/2 px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 text-white text-sm">
            {currentIndex + 1} / {videos.length}
          </div>
        )}

        {/* Navigation Buttons */}
        {videos.length > 1 && (
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

        {/* Video Container */}
        <div className="flex items-center justify-center w-full h-full overflow-hidden">
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              src={currentVideo.url}
              className="max-w-full max-h-full object-contain rounded-lg overflow-hidden"
              controls
              controlsList="nodownload nofullscreen"
              playsInline
              autoPlay
              onEnded={handleVideoEnded}
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              onCanPlay={() => {
                // Auto-play when video is ready (fallback for browsers that don't support autoplay)
                if (!playing && videoRef.current) {
                  const playPromise = videoRef.current.play()
                  if (playPromise !== undefined) {
                    playPromise
                      .then(() => setPlaying(true))
                      .catch(() => setPlaying(false))
                  }
                }
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

