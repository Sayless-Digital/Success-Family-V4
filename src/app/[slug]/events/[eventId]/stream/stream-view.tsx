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
  CallParticipantsList,
  CallStatsButton,
  ScreenShareButton,
  RecordCallButton,
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
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
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowInfo(!showInfo)}
        className="hidden md:flex items-center gap-2 text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200"
      >
        <Info className="h-4 w-4" />
        <span className="text-sm font-medium">Meeting details</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", showInfo && "rotate-180")} />
      </Button>
      
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
function DraggableSelfView() {
  const [position, setPosition] = React.useState({ x: window.innerWidth - 100 - 16, y: window.innerHeight - 180 - 16 })
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 })
  const { useLocalParticipant } = useCallStateHooks()
  const localParticipant = useLocalParticipant()

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    setIsDragging(true)
    setDragOffset({
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    })
  }

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 100))
        const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 180))
        setPosition({ x: newX, y: newY })
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        e.preventDefault()
        const touch = e.touches[0]
        const newX = Math.max(0, Math.min(touch.clientX - dragOffset.x, window.innerWidth - 100))
        const newY = Math.max(0, Math.min(touch.clientY - dragOffset.y, window.innerHeight - 180))
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
  }, [isDragging, dragOffset])

  if (!localParticipant) return null

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
      {/* Video container */}
      <div className="relative w-full h-full">
        <video
          ref={(video) => {
            if (video && localParticipant.videoStream) {
              video.srcObject = localParticipant.videoStream
              video.play().catch(console.error)
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

        {/* Muted indicator */}
        {!localParticipant.publishedTracks.includes('audio') && (
          <div className="absolute top-1.5 right-1.5 bg-red-500 rounded-full p-1">
            <X className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </div>
    </div>
  )
}

// Sidebar component for participants and chat
function StreamSidebar({
  show,
  onClose,
  activeTab,
}: {
  show: boolean
  onClose: () => void
  activeTab: "participants" | "chat"
}) {
  return (
    <div
      className={cn(
        "absolute right-0 top-0 bottom-0 w-80 md:w-96 bg-gray-900/98 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col transition-transform duration-300 ease-out shadow-2xl",
        show ? "translate-x-0" : "translate-x-full"
      )}
    >
      <div className="flex items-center justify-between p-5 border-b border-white/10">
        <h3 className="text-white font-semibold text-lg">
          {activeTab === "participants" ? "People" : "In-call messages"}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-white/70 hover:text-white hover:bg-white/10 rounded-full h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === "participants" ? (
          <div className="p-4">
            <CallParticipantsList onClose={onClose} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageSquare className="h-12 w-12 text-white/30 mb-4" />
            <p className="text-white/60 text-sm">
              In-call messaging coming soon
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
}: {
  event: CommunityEvent
  community: { id: string; name: string; slug: string }
  isOwner: boolean
  onEndCall: () => void
  call: Call
}) {
  const [showSidebar, setShowSidebar] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<"participants" | "chat">("participants")
  const [layout, setLayout] = useState<"speaker" | "grid">("speaker")
  const [isFullscreen, setIsFullscreen] = useState(false)

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
      <div className="fixed inset-0 flex flex-col bg-black overflow-hidden">
        {/* Header - Google Meet style */}
        <div className="flex items-center justify-between px-6 py-3 z-10 flex-shrink-0">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="flex flex-col min-w-0">
              <h1 className="text-base font-medium text-white truncate">
                {event.title}
              </h1>
              <p className="text-xs text-white/60 truncate">{community.name}</p>
            </div>
          </div>
          
          <div className="flex items-center justify-center flex-shrink-0">
            <StreamInfo event={event} community={community} />
          </div>
          
          <div className="flex items-center gap-2 justify-end flex-1">
            <CallStatsButton />
            {isOwner && <RecordCallButton />}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="text-white/70 hover:text-white hover:bg-white/10 rounded-full h-10 w-10 p-0"
              title="Toggle fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Video Layout */}
        <div className="flex-1 relative min-h-0">
          <div className="absolute inset-0 overflow-hidden">
            {layout === "speaker" ? (
              <SpeakerLayout />
            ) : (
              <PaginatedGridLayout />
            )}
          </div>
          
          {/* Floating controls overlay - Top Left */}
          <div className="absolute top-6 left-6 z-20 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLayout(layout === "speaker" ? "grid" : "speaker")}
              className="bg-[#3c4043] hover:bg-[#4d5156] text-white border-0 rounded-lg px-4 h-10 shadow-lg transition-all duration-200"
            >
              <Grid3x3 className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">
                {layout === "speaker" ? "Change to Grid" : "Change to Spotlight"}
              </span>
            </Button>
          </div>

          {/* Floating action buttons - Top Right */}
          <div className="absolute top-6 right-6 z-20 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openSidebar("participants")}
              className={cn(
                "rounded-full h-12 w-12 p-0 shadow-lg transition-all duration-200",
                showSidebar && sidebarTab === "participants"
                  ? "bg-white text-gray-900 hover:bg-white/90"
                  : "bg-[#3c4043] hover:bg-[#4d5156] text-white"
              )}
              title="Show everyone"
            >
              <Users className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openSidebar("chat")}
              className={cn(
                "rounded-full h-12 w-12 p-0 shadow-lg transition-all duration-200",
                showSidebar && sidebarTab === "chat"
                  ? "bg-white text-gray-900 hover:bg-white/90"
                  : "bg-[#3c4043] hover:bg-[#4d5156] text-white"
              )}
              title="Chat with everyone"
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
          </div>

          {/* Draggable Self View - Bottom Right by default (portrait orientation) */}
          <DraggableSelfView />
        </div>

        {/* Bottom Controls Bar - Google Meet floating rounded bar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-3 px-6 py-4 bg-[#202124] rounded-full shadow-2xl border border-white/10">
            {/* Mic toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const audioTrack = call.microphone
                if (audioTrack.state.status === 'enabled') {
                  audioTrack.disable()
                } else {
                  audioTrack.enable()
                }
              }}
              className="h-12 w-12 rounded-full p-0 bg-[#3c4043] hover:bg-[#5f6368] text-white transition-all duration-200"
              title="Toggle microphone"
            >
              {call.microphone.state.status === 'enabled' ? (
                <Mic className="h-5 w-5" />
              ) : (
                <MicOff className="h-5 w-5" />
              )}
            </Button>

            {/* Video toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const videoTrack = call.camera
                if (videoTrack.state.status === 'enabled') {
                  videoTrack.disable()
                } else {
                  videoTrack.enable()
                }
              }}
              className="h-12 w-12 rounded-full p-0 bg-[#3c4043] hover:bg-[#5f6368] text-white transition-all duration-200"
              title="Toggle camera"
            >
              {call.camera.state.status === 'enabled' ? (
                <Video className="h-5 w-5" />
              ) : (
                <VideoOff className="h-5 w-5" />
              )}
            </Button>

            {/* Leave call button */}
            <Button
              onClick={onEndCall}
              className="h-12 w-12 rounded-full p-0 bg-red-600 hover:bg-red-700 text-white transition-all duration-200"
              title="Leave call"
            >
              <Phone className="h-5 w-5 rotate-[135deg]" />
            </Button>
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
        const streamCall = streamClient.call('livestream', callId)

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

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="bg-white/10 backdrop-blur-md border-0">
          <CardContent className="p-8 text-center">
            <p className="text-white/80 mb-4">GetStream API key not configured</p>
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

  if (isLoading) {
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
      />
    </StreamVideo>
  )
}

