"use client"

import React, { useEffect, useState, useRef, useCallback } from "react"
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
  ParticipantView,
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
  Settings,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Slider,
} from "@/components/ui/slider"
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

// Helper to get initials from name
function getInitials(name: string | null | undefined): string {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    // Multiple words: first letter of first name + first letter of last name
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  } else if (parts.length === 1 && parts[0].length >= 2) {
    // Single word with 2+ characters: first 2 letters
    return parts[0].substring(0, 2).toUpperCase()
  } else {
    // Single character: just that character
    return parts[0].charAt(0).toUpperCase()
  }
}

// Microphone Visualizer Component
function MicrophoneVisualizer({ deviceId }: { deviceId: string }) {
  const barRef = React.useRef<HTMLDivElement>(null)
  const audioContextRef = React.useRef<AudioContext | null>(null)
  const analyserRef = React.useRef<AnalyserNode | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const animationFrameRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (!deviceId) return

    const setupAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: deviceId } }
        })
        streamRef.current = stream

        const audioContext = new AudioContext()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 128
        analyser.smoothingTimeConstant = 0.3
        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)

        audioContextRef.current = audioContext
        analyserRef.current = analyser

        const updateLevel = () => {
          if (!analyserRef.current || !barRef.current) {
            animationFrameRef.current = requestAnimationFrame(updateLevel)
            return
          }

          const dataArray = new Uint8Array(analyser.frequencyBinCount)
          analyser.getByteFrequencyData(dataArray)
          
          // Get peak level instead of average for more responsive visualization
          const peak = Math.max(...dataArray)
          const normalized = Math.min(peak / 255, 1)
          
          // Direct DOM manipulation for instant updates (no React state delay)
          barRef.current.style.width = `${normalized * 100}%`
          animationFrameRef.current = requestAnimationFrame(updateLevel)
        }

        updateLevel()
      } catch (error) {
        console.warn('Could not setup microphone visualization:', error)
      }
    }

    setupAudio()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [deviceId])

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 bg-white/10 rounded-full overflow-hidden">
        <div
          ref={barRef}
          className="h-full bg-green-500"
          style={{ width: '0%', transition: 'none' }}
        />
      </div>
      <p className="text-white/60 text-xs">Active</p>
    </div>
  )
}

// Camera Preview Component for Settings Dialog
function CameraPreview({ deviceId, enabled }: { deviceId: string; enabled: boolean }) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)

  React.useEffect(() => {
    if (!enabled || !deviceId) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
      return
    }

    const loadStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } }
        })
        streamRef.current = stream
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(console.error)
        }
      } catch (error) {
        console.warn('Could not load camera preview:', error)
      }
    }

    loadStream()

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }, [deviceId, enabled])

  if (!enabled || !deviceId) return null

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-white/20">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
    </div>
  )
}

// Draggable self-view component - landscape on desktop, portrait on mobile
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
  
  // Responsive dimensions: landscape on desktop, portrait on mobile
  const [isDesktop, setIsDesktop] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : false
  )
  
  const VIDEO_WIDTH = isDesktop ? 240 : 100
  const VIDEO_HEIGHT = isDesktop ? 135 : 180
  
  // React state for position and drag state
  const [position, setPosition] = React.useState(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 }
    const width = window.innerWidth >= 768 ? 240 : 100
    const height = window.innerWidth >= 768 ? 135 : 180
    return {
      x: window.innerWidth - width - PADDING,
      y: window.innerHeight - height - BOTTOM_BAR_HEIGHT - PADDING
    }
  })
  
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 })
  const [opacity, setOpacity] = React.useState(1)
  const [cursor, setCursor] = React.useState<'grab' | 'grabbing'>('grab')
  const [transition, setTransition] = React.useState<string>('none')
  
  const elementRef = React.useRef<HTMLDivElement>(null)
  const animationFrameRef = React.useRef<number | null>(null)
  const pointerIdRef = React.useRef<number | null>(null)
  const positionRef = React.useRef(position)
  
  // Sync positionRef when position changes externally
  React.useEffect(() => {
    positionRef.current = position
  }, [position])
  
  const { useLocalParticipant } = useCallStateHooks()
  const localParticipant = useLocalParticipant()

  // Update desktop state on resize
  React.useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768)
    }
    
    window.addEventListener('resize', checkDesktop)
    checkDesktop()
    
    return () => window.removeEventListener('resize', checkDesktop)
  }, [])

  // Update position when desktop state changes
  React.useEffect(() => {
    const currentWidth = isDesktop ? 240 : 100
    const currentHeight = isDesktop ? 135 : 180
    const bounds = {
      minX: PADDING,
      minY: HEADER_HEIGHT + PADDING,
      maxX: window.innerWidth - currentWidth - PADDING,
      maxY: window.innerHeight - currentHeight - BOTTOM_BAR_HEIGHT - PADDING
    }
    
    setPosition(prev => ({
      x: Math.min(prev.x, bounds.maxX),
      y: Math.max(bounds.minY, Math.min(prev.y, bounds.maxY))
    }))
  }, [isDesktop])

  // Helper to get bounds
  const getBounds = React.useCallback(() => {
    const currentWidth = isDesktop ? 240 : 100
    const currentHeight = isDesktop ? 135 : 180
    return {
      minX: PADDING,
      minY: HEADER_HEIGHT + PADDING,
      maxX: window.innerWidth - currentWidth - PADDING,
      maxY: window.innerHeight - currentHeight - BOTTOM_BAR_HEIGHT - PADDING
    }
  }, [isDesktop])

  // Snap to corner function
  const snapToCorner = React.useCallback(() => {
    const bounds = getBounds()
    const currentWidth = isDesktop ? 240 : 100
    const currentHeight = isDesktop ? 135 : 180
    const centerX = window.innerWidth / 2
    const centerY = (window.innerHeight - HEADER_HEIGHT - BOTTOM_BAR_HEIGHT) / 2 + HEADER_HEIGHT
    
    // Calculate target position
    const isLeft = positionRef.current.x + currentWidth / 2 < centerX
    const isTop = positionRef.current.y + currentHeight / 2 < centerY
    const targetX = isLeft ? bounds.minX : bounds.maxX
    const targetY = isTop ? bounds.minY : bounds.maxY
    
    // Enable transition FIRST
    setTransition('transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)')
    
    // Update position in next frame so browser can animate
    requestAnimationFrame(() => {
      if (elementRef.current) {
        // Update ref for immediate DOM update
        positionRef.current = { x: targetX, y: targetY }
        // Update DOM directly with transition
        elementRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`
        // Sync state for React
        setPosition({ x: targetX, y: targetY })
      }
      
      // Clear transition after animation
      setTimeout(() => setTransition('none'), 300)
    })
  }, [isDesktop, getBounds])

  // Update position during drag - DIRECT DOM UPDATE (no React state, no RAF delay)
  const updatePosition = React.useCallback((clientX: number, clientY: number) => {
    if (!elementRef.current) return
    
    const bounds = getBounds()
    let x = clientX - dragOffset.x
    let y = clientY - dragOffset.y
    
    x = Math.max(bounds.minX, Math.min(x, bounds.maxX))
    y = Math.max(bounds.minY, Math.min(y, bounds.maxY))
    
    // Update DOM directly - zero latency, no React re-render
    elementRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
    
    // Store in ref for state sync later
    positionRef.current = { x, y }
  }, [dragOffset, getBounds])

  // Pointer event handlers
  const handlePointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    pointerIdRef.current = e.pointerId
    
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    
    e.currentTarget.setPointerCapture(e.pointerId)
    setCursor('grabbing')
    setTransition('none')
    setOpacity(0.9)
  }, [])

  const handlePointerMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    e.preventDefault()
    e.stopPropagation()
    
    // DIRECT update - no RAF delay, immediate response
    updatePosition(e.clientX, e.clientY)
  }, [isDragging, updatePosition])

  const handlePointerUp = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    
    setIsDragging(false)
    
    if (pointerIdRef.current !== null && e.currentTarget.hasPointerCapture(pointerIdRef.current)) {
      e.currentTarget.releasePointerCapture(pointerIdRef.current)
      pointerIdRef.current = null
    }
    
    // Sync React state with final position
    setPosition(positionRef.current)
    
    setCursor('grab')
    setOpacity(1)
    snapToCorner()
  }, [isDragging, snapToCorner])

  // Touch event handlers (fallback)
  const handleTouchStart = React.useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (isDragging) return
    e.preventDefault()
    e.stopPropagation()
    
    const touch = e.touches[0]
    setIsDragging(true)
    
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    })
    
    setTransition('none')
    setOpacity(0.9)
  }, [isDragging])

  const handleTouchMove = React.useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return
    e.preventDefault()
    e.stopPropagation()
    
    const touch = e.touches[0]
    
    // DIRECT update - no RAF delay, immediate response
    updatePosition(touch.clientX, touch.clientY)
  }, [isDragging, updatePosition])

  const handleTouchEnd = React.useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return
    e.preventDefault()
    
    setIsDragging(false)
    
    // Sync React state with final position
    setPosition(positionRef.current)
    
    setOpacity(1)
    snapToCorner()
  }, [isDragging, snapToCorner])

  // Handle window resize
  React.useEffect(() => {
    const handleResize = () => {
      const bounds = getBounds()
      setPosition(prev => ({
        x: Math.min(prev.x, bounds.maxX),
        y: Math.max(bounds.minY, Math.min(prev.y, bounds.maxY))
      }))
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [getBounds])

  // Cleanup animation frame on unmount
  React.useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  if (!localParticipant || !visible) return null

  return (
    <div
      ref={elementRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 30,
        // Use position from ref during drag, state only for initial render
        transform: `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0)`,
        transition,
        willChange: 'transform',
        cursor,
        opacity,
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      className={cn(
        "rounded-xl overflow-hidden shadow-2xl border-2 border-white/10 bg-black/20",
        isDesktop ? "w-[240px] h-[135px]" : "w-[100px] h-[180px]"
      )}
    >
      <div className="relative w-full h-full pointer-events-none">
        {/* Use GetStream's ParticipantView for reliable video rendering with custom styles */}
        <div className="absolute inset-0 w-full h-full stream-participant-wrapper stream-preview-small">
          <ParticipantView
            participant={localParticipant}
            className="w-full h-full"
            trackType="videoTrack"
          />
        </div>
        
        {/* Name overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
          <div className="absolute bottom-1.5 left-2 inline-block bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
            <span className="text-white text-xs font-medium whitespace-nowrap">
              {userName}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Custom Participant Video Component
// Uses GetStream's ParticipantView for reliable video, but with custom styling overlays
function ParticipantVideo({
  participant,
  isHost = false,
  call
}: {
  participant: any
  isHost?: boolean
  call?: Call
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Check if video/audio tracks are published
  const publishedTracks = participant.publishedTracks as Set<string> | string[] | undefined
  const hasPublishedVideo = publishedTracks 
    ? (publishedTracks instanceof Set ? publishedTracks.has('videoTrack') : publishedTracks.includes('videoTrack'))
    : !!participant.videoStream || !!(participant as any).videoTrack
  
  const hasAudioTrack = publishedTracks
    ? (publishedTracks instanceof Set ? publishedTracks.has('audioTrack') : publishedTracks.includes('audioTrack'))
    : !!participant.audioStream || !!(participant as any).audioTrack

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-black rounded-lg overflow-hidden border-2 border-white/10 backdrop-blur-sm"
    >
      {/* Use GetStream's ParticipantView for reliable video rendering */}
      {/* CSS customizations are in globals.css to make avatars round */}
      <div className="absolute inset-0 w-full h-full stream-participant-wrapper">
        <ParticipantView
          participant={participant}
          className="w-full h-full"
          trackType="videoTrack"
        />
      </div>
      
      {/* Custom overlays on top */}
      {/* Name overlay */}
      <div className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md max-w-[calc(100%-12px)] z-10">
        {isHost && (
          <Badge className="bg-white/20 text-white text-[10px] px-1.5 py-0 h-4 border-0">
            Host
          </Badge>
        )}
        <span className="text-white text-xs font-medium truncate block">
          {participant.name || 'Unknown'}
          {participant.isLocalParticipant && ' (You)'}
        </span>
      </div>
      
      {/* Muted indicator */}
      {!hasAudioTrack && (
        <div className="absolute top-2 right-2 bg-red-500/90 backdrop-blur-sm rounded-full p-2 z-10">
          <MicOff className="h-4 w-4 text-white" />
        </div>
      )}
    </div>
  )
}

// Custom Speaker Layout - One main speaker, others in sidebar
function CustomSpeakerLayout({ ownerId, call }: { ownerId: string; call: Call }) {
  const { useParticipants } = useCallStateHooks()
  const participants = useParticipants()
  
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
        <ParticipantVideo 
          participant={mainParticipant} 
          isHost={mainParticipant?.userId === ownerId}
          call={call}
        />
      </div>
      
      {/* Other participants sidebar */}
      {otherParticipants.length > 0 && (
        <div className="w-48 flex flex-col gap-2 overflow-y-auto">
          {otherParticipants.map((participant) => (
            <div key={participant.sessionId} className="aspect-video">
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

// Custom Grid Layout - All participants in grid
function CustomGridLayout({ ownerId, call }: { ownerId: string; call: Call }) {
  const { useParticipants } = useCallStateHooks()
  const participants = useParticipants()
  
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
                    {getInitials(participant.name)}
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
                  {!(participant.videoStream || ((participant.publishedTracks as any) && Array.isArray(participant.publishedTracks) && ((participant.publishedTracks as any).includes('videoTrack') || (participant.publishedTracks as any).includes('video'))) || (participant as any).videoTrack) && (
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
  const [isMicLoading, setIsMicLoading] = useState(false)
  const [isCameraLoading, setIsCameraLoading] = useState(false)
  const [hasMicDevice, setHasMicDevice] = useState(false)
  const [hasCameraDevice, setHasCameraDevice] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([])
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedMicId, setSelectedMicId] = useState<string>('')
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [micSensitivity, setMicSensitivity] = useState(50) // 0-100, default 50
  const router = useRouter()

  // Track microphone and camera state from call object
  const getMicState = () => {
    if (!call) return false
    try {
      return call.microphone.state.status === 'enabled'
    } catch {
      return false
    }
  }

  const getCameraState = () => {
    if (!call) return false
    try {
      return call.camera.state.status === 'enabled'
    } catch {
      return false
    }
  }

  const [isMicEnabled, setIsMicEnabled] = React.useState(() => getMicState())
  const [isCameraEnabled, setIsCameraEnabled] = React.useState(() => getCameraState())

  // Poll state updates (Stream.io doesn't always expose reactive state)
  React.useEffect(() => {
    if (!call) return

    const interval = setInterval(() => {
      setIsMicEnabled(getMicState())
      setIsCameraEnabled(getCameraState())
    }, 500)

    return () => clearInterval(interval)
  }, [call])

  // Check for available devices on mount and when settings dialog opens
  const refreshDevices = React.useCallback(async () => {
    try {
      // Request permissions first to get device labels
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      } catch {
        // Permissions denied, but we can still enumerate
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(device => device.kind === 'audioinput')
      const videoInputs = devices.filter(device => device.kind === 'videoinput')
      
      setMicDevices(audioInputs)
      setCameraDevices(videoInputs)
      setHasMicDevice(audioInputs.length > 0)
      setHasCameraDevice(videoInputs.length > 0)
      
      // Set default selected devices
      if (audioInputs.length > 0 && !selectedMicId) {
        setSelectedMicId(audioInputs[0].deviceId)
      }
      if (videoInputs.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoInputs[0].deviceId)
      }
    } catch (error) {
      setHasMicDevice(false)
      setHasCameraDevice(false)
    }
  }, [selectedMicId, selectedCameraId])

  React.useEffect(() => {
    refreshDevices()
  }, [refreshDevices])

  // Refresh devices when settings dialog opens
  React.useEffect(() => {
    if (showSettingsDialog) {
      refreshDevices()
    }
  }, [showSettingsDialog, refreshDevices])

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
              <CustomSpeakerLayout ownerId={event.owner_id} call={call} />
            ) : (
              <CustomGridLayout ownerId={event.owner_id} call={call} />
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
        <div className="flex-shrink-0 h-12 z-20 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md rounded-t-lg border-t border-white/20">
          <div className="h-full flex items-center justify-between md:justify-center md:gap-8 px-1">
            {/* Left: Layout toggle button (view control, less frequently used) */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLayout(layout === "speaker" ? "grid" : "speaker")}
              className="h-10 w-10 rounded-full p-0 bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
              title={layout === "speaker" ? "Spotlight mode" : "Grid mode"}
            >
              {layout === "speaker" ? (
                <User className="h-4 w-4" />
              ) : (
                <Grid3x3 className="h-4 w-4" />
              )}
            </Button>

            {/* Center: Primary call controls (Mic, Camera, Leave) */}
            <div className="flex items-center gap-2">
              {/* Media controls group: Mic and Camera together */}
              <div className="flex items-center gap-1.5">
                {/* Mic toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (isMicLoading || !hasMicDevice) return
                    setIsMicLoading(true)
                    try {
                      if (isMicEnabled) {
                        await call.microphone.disable()
                        setIsMicEnabled(false)
                      } else {
                        // Enable microphone (automatically publishes audio to other participants)
                        await call.microphone.enable()
                        setIsMicEnabled(true)
                      }
                    } catch (error) {
                      console.warn('Could not toggle microphone:', error)
                      setIsMicEnabled(false)
                      toast.error('Failed to enable microphone')
                    } finally {
                      setIsMicLoading(false)
                    }
                  }}
                  disabled={isMicLoading || !hasMicDevice}
                  className={cn(
                    "h-10 w-10 rounded-full p-0 transition-all duration-200",
                    !hasMicDevice
                      ? "bg-white/5 text-white/30 cursor-not-allowed"
                      : isMicLoading
                        ? "bg-white/10 text-white cursor-wait"
                        : isMicEnabled
                          ? "bg-white/10 hover:bg-white/20 text-white"
                          : "bg-red-600 hover:bg-red-700 text-white"
                  )}
                  title={!hasMicDevice ? "No microphone available" : isMicEnabled ? "Mute microphone" : "Unmute microphone"}
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
                    if (isCameraLoading || !hasCameraDevice) return
                    setIsCameraLoading(true)
                    try {
                      if (isCameraEnabled) {
                        await call.camera.disable()
                        setIsCameraEnabled(false)
                      } else {
                        // Enable camera (automatically publishes video to other participants)
                        await call.camera.enable()
                        setIsCameraEnabled(true)
                      }
                    } catch (error) {
                      console.warn('Could not toggle camera:', error)
                      setIsCameraEnabled(false)
                      toast.error('Failed to enable camera')
                    } finally {
                      setIsCameraLoading(false)
                    }
                  }}
                  disabled={isCameraLoading || !hasCameraDevice}
                  className={cn(
                    "h-10 w-10 rounded-full p-0 transition-all duration-200",
                    !hasCameraDevice
                      ? "bg-white/5 text-white/30 cursor-not-allowed"
                      : isCameraLoading
                        ? "bg-white/10 text-white cursor-wait"
                        : isCameraEnabled
                          ? "bg-white/10 hover:bg-white/20 text-white"
                          : "bg-red-600 hover:bg-red-700 text-white"
                  )}
                  title={!hasCameraDevice ? "No camera available" : isCameraEnabled ? "Turn off camera" : "Turn on camera"}
                >
                  {isCameraLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCameraEnabled ? (
                    <Video className="h-4 w-4" />
                  ) : (
                    <VideoOff className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Leave/End call button (primary action, most prominent) */}
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

            {/* Right: Secondary controls (Settings, Self-view, People) */}
            <div className="flex items-center gap-1.5">
              {/* Settings button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettingsDialog(true)}
                className="h-10 w-10 rounded-full p-0 bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>

              {/* Self-view toggle */}
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
              
              {/* People button */}
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

        {/* Settings Dialog */}
        <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
          <DialogContent className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-white/20 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white text-xl font-semibold">Settings</DialogTitle>
            </DialogHeader>
            
            <Tabs defaultValue="microphone" className="w-full mt-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="microphone" className="flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  <span>Microphone</span>
                </TabsTrigger>
                <TabsTrigger value="camera" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  <span>Camera</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="microphone" className="mt-4 space-y-4">
                <div className="space-y-3">
                  {/* Status and Enable/Disable */}
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center gap-3">
                      <Mic className="h-5 w-5 text-white/70" />
                      <div>
                        <p className="text-white font-medium text-sm">Microphone Status</p>
                        <p className="text-white/60 text-xs">
                          {hasMicDevice 
                            ? (isMicEnabled ? "Enabled" : "Disabled") 
                            : "No device available"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (isMicLoading || !hasMicDevice) return
                        setIsMicLoading(true)
                        try {
                          if (isMicEnabled) {
                            await call.microphone.disable()
                            setIsMicEnabled(false)
                          } else {
                            // Enable microphone (automatically publishes audio to other participants)
                            await call.microphone.enable()
                            setIsMicEnabled(true)
                          }
                        } catch (error) {
                          console.warn('Could not toggle microphone:', error)
                          setIsMicEnabled(false)
                          toast.error('Failed to toggle microphone')
                        } finally {
                          setIsMicLoading(false)
                        }
                      }}
                      disabled={isMicLoading || !hasMicDevice}
                      className={cn(
                        "h-8 px-3 text-xs",
                        isMicEnabled
                          ? "bg-red-600 hover:bg-red-700 text-white"
                          : "bg-white/10 hover:bg-white/20 text-white"
                      )}
                    >
                      {isMicLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isMicEnabled ? (
                        "Disable"
                      ) : (
                        "Enable"
                      )}
                    </Button>
                  </div>
                  
                  {/* Device Selection */}
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-white font-medium text-sm mb-3">Device Selection</p>
                    {micDevices.length > 0 ? (
                      <Select
                        value={selectedMicId}
                        onValueChange={async (deviceId) => {
                          setSelectedMicId(deviceId)
                          // Store preference - will be used when enabling next time
                          toast.success('Microphone device preference saved')
                        }}
                        disabled={!hasMicDevice}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select microphone" />
                        </SelectTrigger>
                        <SelectContent>
                          {micDevices.map((device) => (
                            <SelectItem key={device.deviceId} value={device.deviceId}>
                              {device.label || `Microphone ${micDevices.indexOf(device) + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-white/60 text-xs">No devices available</p>
                    )}
                  </div>
                  
                  {/* Microphone Sensitivity */}
                  {hasMicDevice && (
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-white font-medium text-sm">Sensitivity</p>
                        <span className="text-white/60 text-xs tabular-nums">{micSensitivity}%</span>
                      </div>
                      <Slider
                        value={[micSensitivity]}
                        onValueChange={(value) => {
                          setMicSensitivity(value[0])
                        }}
                        min={0}
                        max={100}
                        step={1}
                        className="w-full slider-white"
                      />
                      <div className="flex items-center justify-between mt-2 text-xs text-white/50">
                        <span>Low</span>
                        <span>High</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Microphone Preview */}
                  {isMicEnabled && hasMicDevice && selectedMicId && (
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <p className="text-white font-medium text-sm mb-3">Microphone Preview</p>
                      <MicrophoneVisualizer deviceId={selectedMicId} />
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="camera" className="mt-4 space-y-4">
                <div className="space-y-3">
                  {/* Status and Enable/Disable */}
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center gap-3">
                      <Video className="h-5 w-5 text-white/70" />
                      <div>
                        <p className="text-white font-medium text-sm">Camera Status</p>
                        <p className="text-white/60 text-xs">
                          {hasCameraDevice 
                            ? (isCameraEnabled ? "Enabled" : "Disabled") 
                            : "No device available"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (isCameraLoading || !hasCameraDevice) return
                        setIsCameraLoading(true)
                        try {
                          if (isCameraEnabled) {
                            await call.camera.disable()
                            setIsCameraEnabled(false)
                          } else {
                            // Enable camera (automatically publishes video to other participants)
                            await call.camera.enable()
                            setIsCameraEnabled(true)
                          }
                        } catch (error) {
                          console.warn('Could not toggle camera:', error)
                          setIsCameraEnabled(false)
                          toast.error('Failed to toggle camera')
                        } finally {
                          setIsCameraLoading(false)
                        }
                      }}
                      disabled={isCameraLoading || !hasCameraDevice}
                      className={cn(
                        "h-8 px-3 text-xs",
                        isCameraEnabled
                          ? "bg-red-600 hover:bg-red-700 text-white"
                          : "bg-white/10 hover:bg-white/20 text-white"
                      )}
                    >
                      {isCameraLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isCameraEnabled ? (
                        "Disable"
                      ) : (
                        "Enable"
                      )}
                    </Button>
                  </div>
                  
                  {/* Device Selection */}
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-white font-medium text-sm mb-3">Device Selection</p>
                    {cameraDevices.length > 0 ? (
                      <Select
                        value={selectedCameraId}
                        onValueChange={async (deviceId) => {
                          setSelectedCameraId(deviceId)
                          // Store preference - will be used when enabling next time
                          toast.success('Camera device preference saved')
                        }}
                        disabled={!hasCameraDevice}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select camera" />
                        </SelectTrigger>
                        <SelectContent>
                          {cameraDevices.map((device) => (
                            <SelectItem key={device.deviceId} value={device.deviceId}>
                              {device.label || `Camera ${cameraDevices.indexOf(device) + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-white/60 text-xs">No devices available</p>
                    )}
                  </div>
                  
                  {/* Camera Preview */}
                  {isCameraEnabled && hasCameraDevice && selectedCameraId && (
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <p className="text-white font-medium text-sm mb-3">Camera Preview</p>
                      <CameraPreview
                        deviceId={selectedCameraId}
                        enabled={isCameraEnabled}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
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

        // Create token provider function for automatic token refresh
        const tokenProvider = async () => {
          const tokenResponse = await fetch('/api/stream-token', {
            method: 'POST',
            credentials: 'include',
          })
          
          if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json().catch(() => ({}))
            throw new Error(errorData.error || `Failed to refresh token: ${tokenResponse.status}`)
          }
          
          const { token: newToken } = await tokenResponse.json()
          if (!newToken) {
            throw new Error('No token received from server')
          }
          
          return newToken
        }

        // Initialize Stream client with token provider for automatic refresh
        // When token and user are provided in constructor, it auto-connects
        // No need to call connectUser separately - it's handled internally
        const streamClient = new StreamVideoClient({
          apiKey,
          token,
          tokenProvider, // Enable automatic token refresh when token expires
          user: {
            id: currentUserId,
            name: currentUserName,
            image: currentUserImage || undefined,
          },
        })

        // The client automatically connects when token/user are provided in constructor
        // We can proceed directly to creating/getting the call

        if (!mounted) {
          await streamClient.disconnectUser().catch(console.error)
          return
        }

        // Get or create call - use 'default' type to allow all participants
        // 'livestream' type restricts participation to backstage roles only
        const callId = event.stream_call_id || event.id
        const streamCall = streamClient.call('default', callId)

        // Join call - mic and camera will start disabled by default
        // Users can enable them via the UI, which will publish tracks to other participants
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

