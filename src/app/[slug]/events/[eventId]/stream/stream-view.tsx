"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  Call,
  CallControls,
  SpeakerLayout,
  CallStatsButton,
  ScreenShareButton,
  useCallStateHooks,
  PaginatedGridLayout,
} from "@stream-io/video-react-sdk"
import "@stream-io/video-react-sdk/dist/css/styles.css"
import {
  ArrowLeft,
  Users,
  MessageSquare,
  X,
  Clock,
  Signal,
  Grid3x3,
  Maximize2,
  Info,
  ChevronDown,
  Move,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  MoreVertical,
  LogOut,
  PhoneOff,
  Search,
  User,
  Minimize2,
  PictureInPicture2,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import Silk from "@/components/Silk"
import type { CommunityEvent } from "@/types"

interface StreamViewProps {
  event: CommunityEvent
  community: {
    id: string
    name: string
    slug: string
  }
  currentUserId: string
  currentUserName: string
  currentUserImage?: string | null
  isOwner: boolean
  registrationId?: string
}

// Stream info display component
function StreamInfo({ event, community }: { event: CommunityEvent; community: any }) {
  const [duration, setDuration] = useState("00:00")
  const [showInfo, setShowInfo] = useState(false)
  const { useParticipantCount } = useCallStateHooks()
  const participantCount = useParticipantCount()

  useEffect(() => {
    const startTime = new Date(event.started_at || Date.now())
    const interval = setInterval(() => {
      const now = new Date()
      const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000)
      const hours = Math.floor(diff / 3600)
      const minutes = Math.floor((diff % 3600) / 60)
      const seconds = diff % 60
      if (hours > 0) {
        setDuration(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      } else {
        setDuration(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [event.started_at])

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
        <Clock className="h-3.5 w-3.5 text-white/70" />
        <span className="text-sm text-white font-mono tabular-nums">{duration}</span>
      </div>
      
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
        <Users className="h-3.5 w-3.5 text-white/70" />
        <span className="text-sm text-white font-medium">{participantCount}</span>
      </div>
      
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 backdrop-blur-sm border border-green-500/30">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm text-green-400 font-medium">Live</span>
      </div>
    </div>
  )
}

// Draggable self-view component - portrait orientation (compact)
function DraggableSelfView({
  visible,
  isCameraEnabled,
  userName,
  userImage
}: {
  visible: boolean
  isCameraEnabled: boolean
  userName: string
  userImage?: string | null
}) {
  // Constants for boundaries
  const PADDING = 16
  const HEADER_HEIGHT = 48
  const BOTTOM_BAR_HEIGHT = 48
  const VIDEO_WIDTH = 100
  const VIDEO_HEIGHT = 180
  const DRAG_MULTIPLIER = 3 // Highly exaggerated movement
  
  const [position, setPosition] = React.useState({
    x: window.innerWidth - VIDEO_WIDTH - PADDING,
    y: window.innerHeight - VIDEO_HEIGHT - BOTTOM_BAR_HEIGHT - PADDING
  })
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 })
  const [initialPosition, setInitialPosition] = React.useState({ x: 0, y: 0 })
  const { useLocalParticipant } = useCallStateHooks()
  const localParticipant = useLocalParticipant()

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    setInitialPosition({ x: position.x, y: position.y })
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    setIsDragging(true)
    setDragStart({ x: touch.clientX, y: touch.clientY })
    setInitialPosition({ x: position.x, y: position.y })
  }

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        // Calculate actual movement from drag start
        const actualDeltaX = e.clientX - dragStart.x
        const actualDeltaY = e.clientY - dragStart.y
        
        // Apply multiplier to the movement
        const exaggeratedDeltaX = actualDeltaX * DRAG_MULTIPLIER
        const exaggeratedDeltaY = actualDeltaY * DRAG_MULTIPLIER
        
        // Calculate new position from initial position + exaggerated delta
        const newX = Math.max(PADDING, Math.min(initialPosition.x + exaggeratedDeltaX, window.innerWidth - VIDEO_WIDTH - PADDING))
        const newY = Math.max(HEADER_HEIGHT + PADDING, Math.min(initialPosition.y + exaggeratedDeltaY, window.innerHeight - VIDEO_HEIGHT - BOTTOM_BAR_HEIGHT - PADDING))
        
        setPosition({ x: newX, y: newY })
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        e.preventDefault()
        const touch = e.touches[0]
        
        // Calculate actual movement from drag start
        const actualDeltaX = touch.clientX - dragStart.x
        const actualDeltaY = touch.clientY - dragStart.y
        
        // Apply multiplier to the movement
        const exaggeratedDeltaX = actualDeltaX * DRAG_MULTIPLIER
        const exaggeratedDeltaY = actualDeltaY * DRAG_MULTIPLIER
        
        // Calculate new position from initial position + exaggerated delta
        const newX = Math.max(PADDING, Math.min(initialPosition.x + exaggeratedDeltaX, window.innerWidth - VIDEO_WIDTH - PADDING))
        const newY = Math.max(HEADER_HEIGHT + PADDING, Math.min(initialPosition.y + exaggeratedDeltaY, window.innerHeight - VIDEO_HEIGHT - BOTTOM_BAR_HEIGHT - PADDING))
        
        setPosition({ x: newX, y: newY })
      }
    }

    const handleEnd = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleEnd)
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleEnd)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleEnd)
    }
  }, [isDragging, dragStart, initialPosition])

  if (!localParticipant || !visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 30,
      }}
      className={cn(
        "w-[100px] h-[180px] rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 bg-black touch-none",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Video container or Avatar */}
      <div className="relative w-full h-full">
        {isCameraEnabled ? (
          <>
            <video
              ref={(video) => {
                if (video && localParticipant.videoStream) {
                  if (video.srcObject !== localParticipant.videoStream) {
                    video.srcObject = localParticipant.videoStream
                    video.play().catch((error) => {
                      // Ignore AbortError - it's expected when video changes
                      if (error.name !== 'AbortError') {
                        console.error('Error playing video:', error)
                      }
                    })
                  }
                }
              }}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            {/* Overlay with name */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
              <div className="absolute bottom-1.5 left-2 right-2">
                <span className="text-white text-xs font-medium">
                  You
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <Avatar className="h-20 w-20 border-4 border-white/20">
              <AvatarImage src={userImage || undefined} alt={userName} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white text-2xl">
                {userName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>
    </div>
  )
}

// Custom Participant Video Component
function ParticipantVideo({
  participant
}: {
  participant: any
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const hasVideo = !!participant.videoStream

  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const updateVideoStream = async () => {
      try {
        if (hasVideo && participant.videoStream) {
          if (video.srcObject !== participant.videoStream) {
            video.srcObject = participant.videoStream
            await video.play().catch((error) => {
              if (error.name !== 'AbortError') {
                console.error('Error playing video:', error)
              }
            })
          }
        } else {
          video.srcObject = null
        }
      } catch (error) {
        console.error('Error updating video stream:', error)
      }
    }

    updateVideoStream()
  }, [participant.videoStream, participant.sessionId, hasVideo])

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {hasVideo && participant.videoStream ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={participant.isLocalParticipant}
            className="w-full h-full object-cover"
          />
          {/* Name overlay */}
          <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded">
            <span className="text-white text-sm font-medium truncate block">
              {participant.name || 'Unknown'}
              {participant.isLocalParticipant && ' (You)'}
            </span>
          </div>
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3">
          <Avatar className="h-24 w-24 border-4 border-white/20">
            <AvatarImage src={participant.image} alt={participant.name} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white text-3xl">
              {participant.name?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="text-white text-sm font-medium">
            {participant.name || 'Unknown'}
            {participant.isLocalParticipant && ' (You)'}
          </span>
        </div>
      )}
      
      {/* Muted indicator */}
      {!(participant.audioStream || (participant.publishedTracks && Array.from(participant.publishedTracks).includes('audio'))) && (
        <div className="absolute top-2 right-2 bg-red-500/90 backdrop-blur-sm rounded-full p-2">
          <MicOff className="h-4 w-4 text-white" />
        </div>
      )}
    </div>
  )
}

// Custom Speaker Layout - One main speaker, others in sidebar
function CustomSpeakerLayout() {
  const { useParticipants } = useCallStateHooks()
  const participants = useParticipants()
  
  // Find the dominant speaker or first participant with video, or just first participant
  const mainParticipant = participants.find(p => p.videoStream) || participants[0]
  const otherParticipants = participants.filter(p => p.sessionId !== mainParticipant?.sessionId)

  if (!mainParticipant) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-white/60">Waiting for participants...</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex gap-2 p-2">
      {/* Main speaker */}
      <div className="flex-1">
        <ParticipantVideo participant={mainParticipant} />
      </div>
      
      {/* Other participants sidebar */}
      {otherParticipants.length > 0 && (
        <div className="w-48 flex flex-col gap-2 overflow-y-auto">
          {otherParticipants.map((participant) => (
            <div key={participant.sessionId} className="aspect-video">
              <ParticipantVideo participant={participant} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Custom Grid Layout - All participants in grid
function CustomGridLayout() {
  const { useParticipants } = useCallStateHooks()
  const participants = useParticipants()
  
  const getGridColumns = (count: number) => {
    if (count === 1) return 1
    if (count === 2) return 2
    if (count <= 4) return 2
    if (count <= 9) return 3
    return 4
  }

  const columns = getGridColumns(participants.length)

  if (participants.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-white/60">Waiting for participants...</p>
      </div>
    )
  }

  return (
    <div
      className="w-full h-full p-2 grid gap-2"
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridAutoRows: '1fr',
      }}
    >
      {participants.map((participant) => (
        <ParticipantVideo
          key={participant.sessionId}
          participant={participant}
        />
      ))}
    </div>
  )
}

// Sidebar component for participants and chat - Platform style
function StreamSidebar({
  show,
  onClose,
  activeTab,
}: {
  show: boolean
  onClose: () => void
  activeTab: "participants" | "chat"
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const { useParticipantCount, useParticipants } = useCallStateHooks()
  const participantCount = useParticipantCount()
  const participants = useParticipants()

  // Filter participants based on search
  const filteredParticipants = participants.filter((participant) =>
    participant.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div
      className={cn(
        "absolute right-0 top-0 bottom-12 w-80 md:w-96 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-l border-white/20 z-50 flex flex-col transition-transform duration-300 ease-out shadow-2xl",
        show ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/20">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-white/70" />
          <h3 className="text-white font-semibold text-base">
            {activeTab === "participants" ? `In call (${participantCount})` : "Messages"}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-white/70 hover:text-white hover:bg-white/10 rounded-full h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search Bar - Only show for participants */}
      {activeTab === "participants" && (
        <div className="px-4 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <Input
              type="text"
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:bg-white/10 focus:border-white/30"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {activeTab === "participants" ? (
          <div className="p-4 space-y-2">
            {filteredParticipants.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/60 text-sm">No participants found</p>
              </div>
            ) : (
              filteredParticipants.map((participant) => (
              <div
                key={participant.sessionId}
                className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all duration-200"
              >
                <Avatar className="h-10 w-10 border-2 border-white/20">
                  <AvatarImage src={participant.image} alt={participant.name} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white text-sm">
                    {participant.name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    {participant.name || 'Unknown User'}
                  </p>
                  {participant.isLocalParticipant && (
                    <p className="text-white/60 text-xs">You</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!participant.audioStream && (
                    <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center">
                      <MicOff className="h-3 w-3 text-white/70" />
                    </div>
                  )}
                  {!participant.videoStream && (
                    <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center">
                      <VideoOff className="h-3 w-3 text-white/70" />
                    </div>
                  )}
                </div>
              </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-white/50" />
            </div>
            <h4 className="text-white font-medium mb-2">Messages coming soon</h4>
            <p className="text-white/60 text-sm">
              Chat with participants during the call
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Main call content component
function CallContent({
  event,
  community,
  isOwner,
  onEndCall,
  call,
  currentUserName,
  currentUserImage,
}: {
  event: CommunityEvent
  community: { id: string; name: string; slug: string }
  isOwner: boolean
  onEndCall: () => void
  call: Call
  currentUserName: string
  currentUserImage?: string | null
}) {
  const [showSidebar, setShowSidebar] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<"participants" | "chat">("participants")
  const [layout, setLayout] = useState<"speaker" | "grid">("speaker")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSelfView, setShowSelfView] = useState(true)
  const [isMicEnabled, setIsMicEnabled] = useState(true)
  const [isCameraEnabled, setIsCameraEnabled] = useState(true)
  const [isMicLoading, setIsMicLoading] = useState(false)
  const [isCameraLoading, setIsCameraLoading] = useState(false)
  const router = useRouter()

  const handleLeaveCall = async () => {
    try {
      if (call) {
        await call.leave()
      }
      router.push(`/${community.slug}/events`)
    } catch (error: any) {
      console.error('Error leaving call:', error)
      toast.error('Failed to leave call')
    }
  }

  const handleEndCallForEveryone = async () => {
    try {
      if (call) {
        await call.leave()
      }

      // Update event status to end it for everyone
      await supabase
        .from('community_events')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
        })
        .eq('id', event.id)

      toast.success('Call ended for everyone')
      router.push(`/${community.slug}/events`)
    } catch (error: any) {
      console.error('Error ending call:', error)
      toast.error('Failed to end call')
    }
  }

  const openSidebar = (tab: "participants" | "chat") => {
    if (showSidebar && sidebarTab === tab) {
      setShowSidebar(false)
    } else {
      setSidebarTab(tab)
      setShowSidebar(true)
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  return (
    <StreamCall call={call}>
      {/* Full screen - header and mobile nav are hidden on stream pages */}
      <div className="fixed inset-0 flex flex-col overflow-hidden">
        {/* Aurora Background */}
        <div className="fixed inset-0 z-0 overflow-hidden w-full h-full">
          <div className="w-full h-full">
            <Silk
              speed={0.3}
              scale={1}
              color="#0a0318"
              noiseIntensity={1}
              rotation={0}
            />
          </div>
        </div>
        {/* Header - Platform style matching bottom bar */}
        <div className="flex items-center justify-between px-1 h-12 z-10 flex-shrink-0 relative bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-b border-white/20 rounded-b-lg">
          {/* Left: Community Logo */}
          <div className="flex items-center gap-2 flex-1">
            <div className="h-8 w-8 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm border-4 border-white/20 shadow-lg backdrop-blur-md">
              {community.name[0].toUpperCase()}
            </div>
            <span className="font-semibold text-white text-sm hidden sm:block truncate">
              {community.name}
            </span>
          </div>
          
          {/* Center: Stream Info */}
          <div className="flex items-center justify-center flex-shrink-0">
            <StreamInfo event={event} community={community} />
          </div>
          
          {/* Right: Fullscreen button */}
          <div className="flex items-center justify-end flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="h-10 w-10 rounded-full p-0 bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
              title="Toggle fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Video Layout */}
        <div className="flex-1 relative min-h-0 z-10">
          <div className="absolute inset-0">
            {layout === "speaker" ? (
              <CustomSpeakerLayout />
            ) : (
              <CustomGridLayout />
            )}
          </div>
          
          {/* Draggable Self View - Bottom Right by default (portrait orientation) */}
          <DraggableSelfView
            visible={showSelfView}
            isCameraEnabled={isCameraEnabled}
            userName={currentUserName}
            userImage={currentUserImage}
          />
        </div>

        {/* Bottom Controls Bar - Mobile nav style */}
        <div className="fixed bottom-0 left-0 right-0 z-20 h-12 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md rounded-t-lg border-t border-white/20">
          <div className="h-full flex items-center justify-between gap-3 px-1">
            {/* Left: Layout toggle button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLayout(layout === "speaker" ? "grid" : "speaker")}
              className="h-10 w-10 rounded-full p-0 bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
              title={layout === "speaker" ? "Change to Grid" : "Change to Spotlight"}
            >
              {layout === "speaker" ? (
                <Grid3x3 className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </Button>

            {/* Center: Call controls */}
            <div className="flex items-center gap-3">
              {/* Mic toggle */}
              <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (isMicLoading) return
                setIsMicLoading(true)
                try {
                  const audioTrack = call.microphone
                  if (audioTrack.state.status === 'enabled') {
                    await audioTrack.disable()
                    setIsMicEnabled(false)
                  } else {
                    await audioTrack.enable()
                    setIsMicEnabled(true)
                  }
                } catch (error) {
                  console.error('Error toggling microphone:', error)
                } finally {
                  setIsMicLoading(false)
                }
              }}
              disabled={isMicLoading}
              className={cn(
                "h-10 w-10 rounded-full p-0 transition-all duration-200",
                isMicLoading
                  ? "bg-white/10 text-white cursor-wait"
                  : isMicEnabled
                    ? "bg-white/10 hover:bg-white/20 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
              )}
              title="Toggle microphone"
            >
              {isMicLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isMicEnabled ? (
                <Mic className="h-4 w-4" />
              ) : (
                <MicOff className="h-4 w-4" />
              )}
            </Button>

            {/* Video toggle */}
            <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (isCameraLoading) return
                  setIsCameraLoading(true)
                  try {
                    const videoTrack = call.camera
                    if (videoTrack.state.status === 'enabled') {
                      await videoTrack.disable()
                      setIsCameraEnabled(false)
                    } else {
                      await videoTrack.enable()
                      setIsCameraEnabled(true)
                    }
                  } catch (error) {
                    console.error('Error toggling camera:', error)
                  } finally {
                    setIsCameraLoading(false)
                  }
                }}
                disabled={isCameraLoading}
                className={cn(
                  "h-10 w-10 rounded-full p-0 transition-all duration-200",
                  isCameraLoading
                    ? "bg-white/10 text-white cursor-wait"
                    : isCameraEnabled
                      ? "bg-white/10 hover:bg-white/20 text-white"
                      : "bg-red-600 hover:bg-red-700 text-white"
                )}
                title="Toggle camera"
              >
                {isCameraLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isCameraEnabled ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <VideoOff className="h-4 w-4" />
                )}
              </Button>

              {/* Leave/End call button */}
              {isOwner ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="h-10 w-10 rounded-full p-0 bg-red-600 hover:bg-red-700 text-white transition-all duration-200"
                      title="Call options"
                    >
                      <Phone className="h-4 w-4 rotate-[135deg]" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="mb-2">
                    <DropdownMenuItem onClick={handleLeaveCall}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Leave call
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleEndCallForEveryone}
                      className="text-red-600 focus:text-red-600"
                    >
                      <PhoneOff className="h-4 w-4 mr-2" />
                      End call for everyone
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  onClick={onEndCall}
                  className="h-10 w-10 rounded-full p-0 bg-red-600 hover:bg-red-700 text-white transition-all duration-200"
                  title="Leave call"
                >
                  <Phone className="h-4 w-4 rotate-[135deg]" />
                </Button>
              )}
            </div>

            {/* Right: Self-view toggle and People buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSelfView(!showSelfView)}
                className="h-10 w-10 rounded-full p-0 bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
                title={showSelfView ? "Hide self view" : "Show self view"}
              >
                {showSelfView ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <PictureInPicture2 className="h-4 w-4" />
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openSidebar("participants")}
                className={cn(
                  "h-10 w-10 rounded-full p-0 transition-all duration-200",
                  showSidebar && sidebarTab === "participants"
                    ? "bg-white/20 text-white"
                    : "bg-white/10 hover:bg-white/20 text-white"
                )}
                title="Show people"
              >
                <Users className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <StreamSidebar
          show={showSidebar}
          onClose={() => setShowSidebar(false)}
          activeTab={sidebarTab}
        />
      </div>
    </StreamCall>
  )
}

export default function StreamView({
  event,
  community,
  currentUserId,
  currentUserName,
  currentUserImage,
  isOwner,
  registrationId,
}: StreamViewProps) {
  const router = useRouter()
  const [client, setClient] = useState<StreamVideoClient | null>(null)
  const [call, setCall] = useState<Call | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function initializeStream() {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GETSTREAM_API_KEY
        if (!apiKey) {
          throw new Error('GetStream API key not configured')
        }

        // Get Stream token
        const tokenResponse = await fetch('/api/stream-token', {
          method: 'POST',
          credentials: 'include', // Include cookies for authentication
        })

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json().catch(() => ({}))
          throw new Error(errorData.error || `Failed to get Stream token: ${tokenResponse.status}`)
        }

        const { token } = await tokenResponse.json()
        
        if (!token) {
          throw new Error('No token received from server')
        }

        if (!mounted) return

        // Initialize Stream client with token
        const streamClient = new StreamVideoClient({
          apiKey,
          token,
          user: {
            id: currentUserId,
            name: currentUserName,
            image: currentUserImage || undefined,
          },
        })

        // Connect user
        await streamClient.connectUser(
          {
            id: currentUserId,
            name: currentUserName,
            image: currentUserImage || undefined,
          },
          token
        )

        if (!mounted) {
          await streamClient.disconnectUser().catch(console.error)
          return
        }

        // Get or create call
        const callId = event.stream_call_id || event.id
        const streamCall = streamClient.call('default', callId)

        // Join call
        await streamCall.join({ create: true })

        if (!mounted) {
          await streamCall.leave().catch(console.error)
          await streamClient.disconnectUser().catch(console.error)
          return
        }

        setCall(streamCall)
        setClient(streamClient)
        setIsLoading(false)

        // Update registration joined_at if user is registered
        if (registrationId) {
          await supabase
            .from('event_registrations')
            .update({ joined_at: new Date().toISOString() })
            .eq('id', registrationId)
        }
      } catch (error: any) {
        console.error('Error initializing stream:', error)
        if (mounted) {
          setError(error.message || 'Failed to connect to stream')
          setIsLoading(false)
          toast.error(error.message || 'Failed to connect to stream')
        }
      }
    }

    initializeStream()

    return () => {
      mounted = false
      // Cleanup
      if (call) {
        call.leave().catch(console.error)
      }
      if (client) {
        client.disconnectUser().catch(console.error)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  const handleEndCall = async () => {
    try {
      if (call) {
        await call.leave()
      }

      // Update event status if owner ends call
      if (isOwner) {
        await supabase
          .from('community_events')
          .update({
            status: 'completed',
            ended_at: new Date().toISOString(),
          })
          .eq('id', event.id)
      }

      router.push(`/${community.slug}/events`)
    } catch (error: any) {
      console.error('Error ending call:', error)
      toast.error('Failed to end call')
    }
  }

  if (isLoading || !client) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white mx-auto" />
          <p className="text-white/80">Connecting to stream...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="bg-white/10 backdrop-blur-md border-0">
          <CardContent className="p-8 text-center">
            <p className="text-white/80 mb-4">{error}</p>
            <Button
              onClick={() => router.push(`/${community.slug}/events`)}
              className="bg-white/10 text-white/80 hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Events
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!call) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white mx-auto" />
          <p className="text-white/80">Connecting to stream...</p>
        </div>
      </div>
    )
  }

  return (
    <StreamVideo client={client}>
      <CallContent
        event={event}
        community={community}
        isOwner={isOwner}
        onEndCall={handleEndCall}
        call={call}
        currentUserName={currentUserName}
        currentUserImage={currentUserImage}
      />
    </StreamVideo>
  )
}

