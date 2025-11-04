"use client"

import React from "react"
import { useCallStateHooks, type Call } from "@stream-io/video-react-sdk"
import { cn } from "@/lib/utils"
import { ParticipantVideo } from "./participant-video"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LayoutProps {
  ownerId: string
  call: Call
  onViewChange?: (view: 'spotlight' | 'grid') => void
}

/**
 * Mobile Swipeable Layout - Switches between spotlight and grid views
 * View 1: Full-screen host spotlight only
 * View 2: All participants grid
 */
export function MobileSwipeableLayout({ ownerId, call, onViewChange }: LayoutProps) {
  const [currentView, setCurrentView] = React.useState<'spotlight' | 'grid'>('spotlight')
  const [touchStart, setTouchStart] = React.useState<number | null>(null)
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Minimum swipe distance (in px) to trigger view change
  const minSwipeDistance = 50

  // Notify parent of view changes (only on actual changes, not on mount)
  const prevViewRef = React.useRef<'spotlight' | 'grid'>()
  
  React.useEffect(() => {
    if (onViewChange && prevViewRef.current !== undefined && prevViewRef.current !== currentView) {
      onViewChange(currentView)
    }
    prevViewRef.current = currentView
  }, [currentView, onViewChange])

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe && currentView === 'spotlight') {
      setCurrentView('grid')
    } else if (isRightSwipe && currentView === 'grid') {
      setCurrentView('spotlight')
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* View Container */}
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{
          transform: currentView === 'spotlight' ? 'translateX(0%)' : 'translateX(-50%)',
          width: '200%'
        }}
      >
        {/* View 1: Full-screen Host Spotlight */}
        <div className="w-1/2 h-full flex-shrink-0">
          <MobileSpotlightView ownerId={ownerId} call={call} />
        </div>

        {/* View 2: All Participants Grid */}
        <div className="w-1/2 h-full flex-shrink-0">
          <CustomGridLayout ownerId={ownerId} call={call} />
        </div>
      </div>

      {/* Navigation Arrows */}
      {currentView === 'spotlight' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentView('grid')}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full p-0 bg-black/30 hover:bg-black/40 backdrop-blur-md border border-white/20 text-white transition-all duration-200 z-10 shadow-lg"
          title="View all participants"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      )}

      {currentView === 'grid' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentView('spotlight')}
          className="absolute left-2 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full p-0 bg-black/30 hover:bg-black/40 backdrop-blur-md border border-white/20 text-white transition-all duration-200 z-10 shadow-lg"
          title="View host spotlight"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
      )}

      {/* View Indicator Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        <div
          className={cn(
            "h-2 w-2 rounded-full transition-all duration-200",
            currentView === 'spotlight' ? "bg-white" : "bg-white/30"
          )}
        />
        <div
          className={cn(
            "h-2 w-2 rounded-full transition-all duration-200",
            currentView === 'grid' ? "bg-white" : "bg-white/30"
          )}
        />
      </div>
    </div>
  )
}

/**
 * Mobile Spotlight View - Shows ONLY the host in full-screen
 */
function MobileSpotlightView({ ownerId, call }: LayoutProps) {
  const { useParticipants } = useCallStateHooks()
  const participants = useParticipants()
  
  // Find the host/owner
  const hostParticipant = participants.find(p => p.userId === ownerId)
  
  if (!hostParticipant) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-white/60">Waiting for host...</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex items-center justify-center p-2">
      <div className="w-full h-full">
        <ParticipantVideo
          participant={hostParticipant}
          isHost={true}
          call={call}
        />
      </div>
    </div>
  )
}

/**
 * Desktop Speaker Layout - One main speaker, others in sidebar
 * Prioritizes the host/owner as the main spotlight participant
 * Used on desktop/tablet devices
 */
export function CustomSpeakerLayout({ ownerId, call }: LayoutProps) {
  const { useParticipants } = useCallStateHooks()
  const participants = useParticipants()
  const [isPortrait, setIsPortrait] = React.useState(false)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  
  // Prioritize the host/owner as the main spotlight participant
  // 1. First try to find owner with video
  // 2. Then try owner without video
  // 3. Then any participant with video
  // 4. Finally, just first participant
  const ownerParticipant = participants.find(p => p.userId === ownerId)
  
  // Helper to check if participant has video (check multiple properties)
  const hasVideo = (p: any) => {
    const tracks = p.publishedTracks as any
    return !!(p.videoStream ||
             (tracks && Array.isArray(tracks) && (tracks.includes('videoTrack') || tracks.includes('video'))) ||
             p.videoTrack)
  }
  
  const mainParticipant =
    (ownerParticipant && hasVideo(ownerParticipant) ? ownerParticipant : null) ||
    ownerParticipant ||
    participants.find(p => hasVideo(p)) ||
    participants[0]
  const otherParticipants = participants.filter(p => p.sessionId !== mainParticipant?.sessionId)

  // Detect video orientation
  React.useEffect(() => {
    const checkOrientation = () => {
      // Find the video element in the main participant view
      const container = document.querySelector('.main-spotlight-video')
      const video = container?.querySelector('video') as HTMLVideoElement
      
      if (video && video.videoWidth && video.videoHeight) {
        const aspectRatio = video.videoWidth / video.videoHeight
        setIsPortrait(aspectRatio < 1)
        videoRef.current = video
      }
    }

    // Check immediately
    checkOrientation()

    // Check periodically for video dimension changes
    const interval = setInterval(checkOrientation, 1000)

    return () => clearInterval(interval)
  }, [mainParticipant])

  if (!mainParticipant) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-white/60">Waiting for participants...</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex gap-2 p-2">
      {/* Main speaker - portrait optimized layout */}
      <div className={cn(
        "flex items-center flex-shrink-0",
        isPortrait ? "justify-start" : "justify-center flex-1"
      )}
      style={isPortrait ? { maxWidth: 'min(45vh, 90vw)', width: '100%' } : undefined}
      >
        <div className="main-spotlight-video w-full h-full">
          <ParticipantVideo
            participant={mainParticipant}
            isHost={mainParticipant?.userId === ownerId}
            call={call}
          />
        </div>
      </div>
      
      {/* Other participants sidebar - scrollable */}
      {otherParticipants.length > 0 && (
        <div className={cn(
          "flex flex-col gap-2 overflow-y-auto flex-shrink-0",
          isPortrait ? "w-auto" : "w-64"
        )}>
          {otherParticipants.map((participant) => (
            <div
              key={participant.sessionId}
              className={cn(
                "flex-shrink-0",
                isPortrait ? "w-48" : "w-full"
              )}
              style={{ aspectRatio: '16/9' }}
            >
              <ParticipantVideo
                participant={participant}
                isHost={participant.userId === ownerId}
                call={call}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Custom Grid Layout - All participants in scrollable grid
 * Sorts participants with host first, then others
 * On mobile: Single column, full-screen cards, scrollable vertically
 * On desktop: Responsive grid layout
 */
export function CustomGridLayout({ ownerId, call }: LayoutProps) {
  const { useParticipants } = useCallStateHooks()
  const participants = useParticipants()
  const [isMobile, setIsMobile] = React.useState(false)
  
  // Detect mobile device
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  // Sort participants: host first, then others
  const sortedParticipants = [...participants].sort((a, b) => {
    const aIsOwner = a.userId === ownerId
    const bIsOwner = b.userId === ownerId
    if (aIsOwner && !bIsOwner) return -1
    if (!aIsOwner && bIsOwner) return 1
    return 0
  })
  
  const getGridColumns = (count: number) => {
    if (count === 1) return 1
    if (count === 2) return 2
    if (count <= 4) return 2
    if (count <= 9) return 3
    return 4
  }

  const columns = getGridColumns(sortedParticipants.length)

  if (sortedParticipants.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-white/60">Waiting for participants...</p>
      </div>
    )
  }

  // Mobile: Vertical scrollable list with landscape aspect ratio
  if (isMobile) {
    return (
      <div className="w-full h-full overflow-y-auto">
        <div className="flex flex-col gap-4 p-2">
          {sortedParticipants.map((participant) => (
            <div
              key={participant.sessionId}
              className="w-full flex-shrink-0"
              style={{ aspectRatio: '16/9' }}
            >
              <ParticipantVideo
                participant={participant}
                isHost={participant.userId === ownerId}
                call={call}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Desktop: Grid layout
  return (
    <div className="w-full h-full p-2 overflow-y-auto">
      <div
        className="grid gap-2 w-full"
        style={{
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
        }}
      >
        {sortedParticipants.map((participant) => (
          <div key={participant.sessionId} className="w-full" style={{ aspectRatio: '16/9' }}>
            <ParticipantVideo
              participant={participant}
              isHost={participant.userId === ownerId}
              call={call}
            />
          </div>
        ))}
      </div>
    </div>
  )
}