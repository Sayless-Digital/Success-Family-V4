"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import {
  User,
  Grid3x3,
  Maximize2,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Phone,
  LogOut,
  PhoneOff,
  Loader2,
  Settings,
  Minimize2,
  PictureInPicture2,
  Users,
  Monitor,
  MonitorOff,
  Circle,
  Square,
} from "lucide-react"
import { StreamCall, type Call, useCallStateHooks, hasScreenShare } from "@stream-io/video-react-sdk"
import { Button } from "@/components/ui/button"
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
import { StreamInfo } from "./stream-info"
import { CustomSpeakerLayout, CustomGridLayout, MobileSwipeableLayout } from "./stream-layouts"
import { DraggableSelfView } from "./draggable-self-view"
import { StreamSidebar } from "./stream-sidebar"
import { SettingsDialog } from "./settings-dialog"

interface CallContentProps {
  event: CommunityEvent
  community: { id: string; name: string; slug: string }
  isOwner: boolean
  onEndCall: () => void
  call: Call
  currentUserName: string
  currentUserImage?: string | null
}

/**
 * Main call content component
 * Manages all call UI state and controls
 */
export function CallContent({
  event,
  community,
  isOwner,
  onEndCall,
  call,
  currentUserName,
  currentUserImage,
}: CallContentProps) {
  const [showSidebar, setShowSidebar] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<"participants" | "chat">("participants")
  const [layout, setLayout] = useState<"speaker" | "grid">("speaker")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSelfView, setShowSelfView] = useState(true)
  const [isMicLoading, setIsMicLoading] = useState(false)
  const [isCameraLoading, setIsCameraLoading] = useState(false)
  const [isSpeakerLoading, setIsSpeakerLoading] = useState(false)
  const [isScreenShareLoading, setIsScreenShareLoading] = useState(false)
  const [isRecordingLoading, setIsRecordingLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [hasMicDevice, setHasMicDevice] = useState(false)
  const [hasCameraDevice, setHasCameraDevice] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([])
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedMicId, setSelectedMicId] = useState<string>('')
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [micSensitivity, setMicSensitivity] = useState(50) // 0-100, default 50
  const [isMobile, setIsMobile] = useState(false)
  const [mobileView, setMobileView] = useState<'spotlight' | 'grid'>('spotlight')

  // Detect mobile device
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Auto-manage self-view based on view mode
  React.useEffect(() => {
    if (isMobile) {
      // Mobile: Hide self-view on spotlight, show on grid
      setShowSelfView(mobileView === 'grid')
    } else {
      // Desktop: Hide self-view on speaker/spotlight, show on grid
      setShowSelfView(layout === 'grid')
    }
  }, [isMobile, mobileView, layout])

  // Handle mobile view changes from swipeable layout
  const handleMobileViewChange = React.useCallback((view: 'spotlight' | 'grid') => {
    setMobileView(view)
  }, [])

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
      console.error('[Device Enumeration Error]', error)
      setHasMicDevice(false)
      setHasCameraDevice(false)
    }
  }, [selectedMicId, selectedCameraId])

  // Listen for device changes
  React.useEffect(() => {
    const handleDeviceChange = () => {
      refreshDevices()
    }

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
      }
    }
  }, [refreshDevices])

  React.useEffect(() => {
    refreshDevices()
  }, [refreshDevices])

  // Refresh devices when settings dialog opens
  React.useEffect(() => {
    if (showSettingsDialog) {
      refreshDevices()
    }
  }, [showSettingsDialog, refreshDevices])

  return (
    <StreamCall call={call}>
      <CallContentInner
        event={event}
        community={community}
        isOwner={isOwner}
        onEndCall={onEndCall}
        call={call}
        currentUserName={currentUserName}
        currentUserImage={currentUserImage}
        showSidebar={showSidebar}
        setShowSidebar={setShowSidebar}
        sidebarTab={sidebarTab}
        setSidebarTab={setSidebarTab}
        layout={layout}
        setLayout={setLayout}
        isFullscreen={isFullscreen}
        setIsFullscreen={setIsFullscreen}
        showSelfView={showSelfView}
        setShowSelfView={setShowSelfView}
        isMicLoading={isMicLoading}
        setIsMicLoading={setIsMicLoading}
        isCameraLoading={isCameraLoading}
        setIsCameraLoading={setIsCameraLoading}
        isSpeakerLoading={isSpeakerLoading}
        setIsSpeakerLoading={setIsSpeakerLoading}
        isScreenShareLoading={isScreenShareLoading}
        setIsScreenShareLoading={setIsScreenShareLoading}
        isRecordingLoading={isRecordingLoading}
        setIsRecordingLoading={setIsRecordingLoading}
        isRecording={isRecording}
        setIsRecording={setIsRecording}
        hasMicDevice={hasMicDevice}
        hasCameraDevice={hasCameraDevice}
        showSettingsDialog={showSettingsDialog}
        setShowSettingsDialog={setShowSettingsDialog}
        micDevices={micDevices}
        cameraDevices={cameraDevices}
        selectedMicId={selectedMicId}
        setSelectedMicId={setSelectedMicId}
        selectedCameraId={selectedCameraId}
        setSelectedCameraId={setSelectedCameraId}
        micSensitivity={micSensitivity}
        setMicSensitivity={setMicSensitivity}
        isMobile={isMobile}
        mobileView={mobileView}
        handleMobileViewChange={handleMobileViewChange}
        refreshDevices={refreshDevices}
      />
    </StreamCall>
  )
}

/**
 * Inner component that uses StreamCall hooks
 * Must be rendered inside StreamCall context
 */
function CallContentInner({
  event,
  community,
  isOwner,
  onEndCall,
  call,
  currentUserName,
  currentUserImage,
  showSidebar,
  setShowSidebar,
  sidebarTab,
  setSidebarTab,
  layout,
  setLayout,
  isFullscreen,
  setIsFullscreen,
  showSelfView,
  setShowSelfView,
  isMicLoading,
  setIsMicLoading,
  isCameraLoading,
  setIsCameraLoading,
  isSpeakerLoading,
  setIsSpeakerLoading,
  isScreenShareLoading,
  setIsScreenShareLoading,
  isRecordingLoading,
  setIsRecordingLoading,
  isRecording,
  setIsRecording,
  hasMicDevice,
  hasCameraDevice,
  showSettingsDialog,
  setShowSettingsDialog,
  micDevices,
  cameraDevices,
  selectedMicId,
  setSelectedMicId,
  selectedCameraId,
  setSelectedCameraId,
  micSensitivity,
  setMicSensitivity,
  isMobile,
  mobileView,
  handleMobileViewChange,
  refreshDevices,
}: CallContentProps & {
  showSidebar: boolean
  setShowSidebar: (show: boolean) => void
  sidebarTab: "participants" | "chat"
  setSidebarTab: (tab: "participants" | "chat") => void
  layout: "speaker" | "grid"
  setLayout: (layout: "speaker" | "grid") => void
  isFullscreen: boolean
  setIsFullscreen: (isFullscreen: boolean) => void
  showSelfView: boolean
  setShowSelfView: (show: boolean) => void
  isMicLoading: boolean
  setIsMicLoading: (loading: boolean) => void
  isCameraLoading: boolean
  setIsCameraLoading: (loading: boolean) => void
  isSpeakerLoading: boolean
  setIsSpeakerLoading: (loading: boolean) => void
  isScreenShareLoading: boolean
  setIsScreenShareLoading: (loading: boolean) => void
  isRecordingLoading: boolean
  setIsRecordingLoading: (loading: boolean) => void
  isRecording: boolean
  setIsRecording: (recording: boolean) => void
  hasMicDevice: boolean
  hasCameraDevice: boolean
  showSettingsDialog: boolean
  setShowSettingsDialog: (show: boolean) => void
  micDevices: MediaDeviceInfo[]
  cameraDevices: MediaDeviceInfo[]
  selectedMicId: string
  setSelectedMicId: (id: string) => void
  selectedCameraId: string
  setSelectedCameraId: (id: string) => void
  micSensitivity: number
  setMicSensitivity: (sensitivity: number) => void
  isMobile: boolean
  mobileView: 'spotlight' | 'grid'
  handleMobileViewChange: (view: 'spotlight' | 'grid') => void
  refreshDevices: () => Promise<void>
}) {
  const router = useRouter()

  // Use GetStream's reactive hooks for device state (must be inside StreamCall context)
  const { useMicrophoneState, useCameraState, useSpeakerState, useScreenShareState } = useCallStateHooks()
  const microphoneState = useMicrophoneState()
  const cameraState = useCameraState()
  const { speaker } = useSpeakerState()
  const screenShareState = useScreenShareState()
  
  // Check recording state from call
  React.useEffect(() => {
    const checkRecordingState = async () => {
      try {
        // Check if call has recording active via API
        const callId = call.id || event.id
        const response = await fetch(`/api/recordings/list?callId=${callId}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch recordings')
        }
        
        const data = await response.json()
        const recordings = data.recordings || []
        
        // Check for active recording - look at various possible status values
        const activeRecording = recordings?.find((r: any) => {
          const status = r.status || r.state || r.recording_status
          // Recording is active if status indicates it's recording or in progress
          return status === 'recording' || 
                 status === 'in_progress' || 
                 status === 'active' ||
                 status === 'started' ||
                 (r.start_time && !r.end_time) // Has start time but no end time
        })
        
        // Also check call state directly for recording status
        const callRecordingState = (call as any).recordingState || (call as any).state?.recording
        const isCurrentlyRecording = callRecordingState?.status === 'recording' || 
                                     callRecordingState?.status === 'active' ||
                                     callRecordingState === 'recording' ||
                                     callRecordingState === true
        
        setIsRecording(!!activeRecording || isCurrentlyRecording)
      } catch (error) {
        // If listRecordings fails, try to check call state directly
        try {
          const callRecordingState = (call as any).recordingState || (call as any).state?.recording
          const isCurrentlyRecording = callRecordingState?.status === 'recording' || 
                                       callRecordingState?.status === 'active' ||
                                       callRecordingState === 'recording' ||
                                       callRecordingState === true
          setIsRecording(isCurrentlyRecording)
        } catch (fallbackError) {
          // If both checks fail, assume not recording
          setIsRecording(false)
        }
      }
    }
    
    // Check immediately on mount
    checkRecordingState()
    
    // Poll every 3 seconds to check recording state (more frequent for better UX)
    const interval = setInterval(checkRecordingState, 3000)
    return () => clearInterval(interval)
  }, [call, setIsRecording])
  
  // Use local state to track mic/camera/screen share status since Stream SDK's reactive state may not update immediately
  // Start with false since devices are disabled when joining the call
  const [localMicEnabled, setLocalMicEnabled] = React.useState<boolean>(false)
  const [localCameraEnabled, setLocalCameraEnabled] = React.useState<boolean>(false)
  const [localScreenShareEnabled, setLocalScreenShareEnabled] = React.useState<boolean>(false)
  
  // Check if screen sharing is supported in the browser
  const isScreenShareSupported = React.useMemo(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
    // Check if getDisplayMedia is available
    const hasGetDisplayMedia = navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function'
    // Check if HTTPS is available (localhost is allowed for development)
    const isSecureContext = window.location.protocol === 'https:' || 
                           window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1'
    return hasGetDisplayMedia && isSecureContext
  }, [])
  
  // Update local state based on Stream SDK reactive state
  // The hooks return state objects that may have different property names
  React.useEffect(() => {
    // Try to get enabled state from the microphone state object
    // Stream SDK may use 'enabled', 'isEnabled', or other properties
    const micEnabled = (microphoneState as any)?.enabled ?? (microphoneState as any)?.isEnabled ?? false
    setLocalMicEnabled(micEnabled)
  }, [microphoneState])
  
  React.useEffect(() => {
    // Try to get enabled state from the camera state object
    const camEnabled = (cameraState as any)?.enabled ?? (cameraState as any)?.isEnabled ?? false
    setLocalCameraEnabled(camEnabled)
  }, [cameraState])
  
  // Get participants to check for screen share tracks
  const { useParticipants } = useCallStateHooks()
  const participants = useParticipants()
  const localParticipant = participants.find(p => p.isLocalParticipant)
  
  React.useEffect(() => {
    // Try to get enabled state from the screen share state object
    const screenShareEnabled = (screenShareState as any)?.isSharing ?? (screenShareState as any)?.enabled ?? false
    setLocalScreenShareEnabled(screenShareEnabled)
  }, [screenShareState])
  
  // Also check participant's published tracks for screen share
  React.useEffect(() => {
    if (localParticipant) {
      // Use SDK's hasScreenShare utility (most reliable)
      let hasScreenShareValue = false
      if (typeof hasScreenShare === 'function') {
        try {
          hasScreenShareValue = hasScreenShare(localParticipant)
        } catch (e) {
          // Fallback to manual check if SDK utility fails
          const publishedTracks = localParticipant.publishedTracks as any
          const tracksArray = publishedTracks instanceof Set 
            ? Array.from(publishedTracks) 
            : (Array.isArray(publishedTracks) ? publishedTracks : [])
          const tracksAsStrings = tracksArray.map((t: any) => String(t).toLowerCase())
          hasScreenShareValue = tracksAsStrings.includes('screensharetrack') || 
                                tracksAsStrings.some((t: string) => t.includes('screenshare')) ||
                                !!(localParticipant as any).screenShareStream || 
                                !!(localParticipant as any).screenShareTrack
        }
      } else {
        // Fallback if hasScreenShare is not available
        const publishedTracks = localParticipant.publishedTracks as any
        const tracksArray = publishedTracks instanceof Set 
          ? Array.from(publishedTracks) 
          : (Array.isArray(publishedTracks) ? publishedTracks : [])
        const tracksAsStrings = tracksArray.map((t: any) => String(t).toLowerCase())
        hasScreenShareValue = tracksAsStrings.includes('screensharetrack') || 
                              tracksAsStrings.some((t: string) => t.includes('screenshare')) ||
                              !!(localParticipant as any).screenShareStream || 
                              !!(localParticipant as any).screenShareTrack
      }
      
      // Only update if value actually changed to prevent infinite loops
      setLocalScreenShareEnabled(prev => {
        if (prev !== hasScreenShareValue) {
          return hasScreenShareValue
        }
        return prev
      })
    }
  }, [localParticipant])
  
  const isMicEnabled = localMicEnabled
  const isCameraEnabled = localCameraEnabled
  const isScreenShareEnabled = localScreenShareEnabled
  // Track speaker enabled state (volume > 0)
  // Use local state to track volume since Stream SDK's reactive state may not update immediately
  // Access volume through type assertion since Stream SDK types may not expose it directly
  const speakerVolume = (speaker as any)?.volume ?? 1
  const [localSpeakerVolume, setLocalSpeakerVolume] = React.useState<number>(speakerVolume)
  const previousSpeakerVolumeRef = React.useRef<number>(1) // Store previous volume for unmute
  
  // Update local volume when speaker volume changes (sync with Stream SDK)
  React.useEffect(() => {
    const currentVolume = (speaker as any)?.volume
    if (currentVolume !== undefined && currentVolume !== localSpeakerVolume) {
      setLocalSpeakerVolume(currentVolume)
      if (currentVolume > 0) {
        previousSpeakerVolumeRef.current = currentVolume
      }
    }
  }, [speaker, localSpeakerVolume])
  
  const currentSpeakerVolume = localSpeakerVolume
  const isSpeakerEnabled = currentSpeakerVolume > 0

  // Save recording to Supabase Storage
  const saveRecordingToStorage = async (retryCount = 0, maxRetries = 5) => {
    console.log(`[Recording Save] Starting save attempt ${retryCount + 1}/${maxRetries + 1}`)
    try {
      // Get recordings from Stream.io via API
      console.log('[Recording Save] Fetching recordings from Stream.io API...')
      const callId = call.id || event.id
      const recordingsResponse = await fetch(`/api/recordings/list?callId=${callId}`)
      
      if (!recordingsResponse.ok) {
        throw new Error(`Failed to fetch recordings: ${recordingsResponse.statusText}`)
      }
      
      const data = await recordingsResponse.json()
      const recordings = data.recordings || []
      console.log('[Recording Save] Recordings received:', recordings)
      console.log('[Recording Save] First recording structure:', recordings[0] ? Object.keys(recordings[0]) : 'No recordings')
      if (recordings[0]) {
        console.log('[Recording Save] First recording full data:', JSON.stringify(recordings[0], null, 2).substring(0, 2000))
      }
      
      // Find the most recent completed recording (not currently recording)
      const completedRecordings = recordings?.filter((r: any) => {
        const status = r.status || r.state || r.recording_status
        return status === 'completed' || 
               status === 'finished' || 
               status === 'done' ||
               (r.end_time && r.start_time) // Has both start and end time
      })
      
      const latestRecording = completedRecordings?.[0] || recordings?.[0] // Fallback to most recent if no completed ones
      
      if (!latestRecording) {
        // If no recording found and we haven't exhausted retries, wait and try again
        if (retryCount < maxRetries) {
          console.log(`No recording found yet, retrying in 3 seconds... (${retryCount + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, 3000))
          return saveRecordingToStorage(retryCount + 1, maxRetries)
        }
        throw new Error('No recording found. Recording may still be processing.')
      }

      // Get recording URL - try multiple possible property names
      const recordingUrl = latestRecording.url || 
                          latestRecording.file || 
                          latestRecording.download_url ||
                          latestRecording.recording_url ||
                          (latestRecording as any).files?.[0]?.url

      if (!recordingUrl) {
        // If no URL yet and we haven't exhausted retries, wait and try again
        if (retryCount < maxRetries) {
          console.log(`Recording URL not available yet, retrying in 3 seconds... (${retryCount + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, 3000))
          return saveRecordingToStorage(retryCount + 1, maxRetries)
        }
        throw new Error('Recording URL not available yet. It may still be processing. Please try saving manually later from the Recordings page.')
      }

      // Get recording ID - try multiple possible property names
      const recordingId = latestRecording.id || 
                          latestRecording.recording_id ||
                          latestRecording.session_id ||
                          `recording-${Date.now()}`

      // Get timestamps - try multiple possible property names
      const startTime = latestRecording.start_time || 
                       latestRecording.started_at ||
                       latestRecording.start ||
                       latestRecording.created_at
      const endTime = latestRecording.end_time || 
                     latestRecording.ended_at ||
                     latestRecording.end ||
                     latestRecording.completed_at
      const duration = latestRecording.duration || 
                      (startTime && endTime ? new Date(endTime).getTime() - new Date(startTime).getTime() : undefined)

      // Try to extract thumbnail from video (client-side)
      let thumbnailDataUrl: string | null = null
      try {
        console.log('[Recording Save] Attempting to extract thumbnail from video...')
        const { extractVideoThumbnail } = await import('@/lib/video-thumbnail')
        thumbnailDataUrl = await extractVideoThumbnail(recordingUrl, 1) // Extract frame at 1 second
        console.log('[Recording Save] Thumbnail extracted successfully')
      } catch (thumbnailError: any) {
        console.warn('[Recording Save] Failed to extract thumbnail:', thumbnailError.message)
        // Continue without thumbnail - server will handle it
      }

      // Call API route to save recording
      console.log('[Recording Save] Calling API with data:', {
        eventId: event.id,
        communityId: community.id,
        streamRecordingId: recordingId,
        streamRecordingUrl: recordingUrl,
        startedAt: startTime,
        endedAt: endTime,
        duration: duration,
        hasThumbnail: !!thumbnailDataUrl,
        streamRecordingData: latestRecording, // Pass full recording data for thumbnail extraction
      })
      
      const response = await fetch('/api/recordings/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: event.id,
          communityId: community.id,
          streamRecordingId: recordingId,
          streamRecordingUrl: recordingUrl,
          startedAt: startTime,
          endedAt: endTime,
          duration: duration,
          thumbnailDataUrl: thumbnailDataUrl, // Send extracted thumbnail as data URL
          streamRecordingData: latestRecording, // Pass full recording data for thumbnail extraction
        }),
      })

      console.log('[Recording Save] API response status:', response.status, response.statusText)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[Recording Save] API error:', error)
        throw new Error(error.error || error.message || 'Failed to save recording')
      }

      const result = await response.json()
      console.log('[Recording Save] API success:', result)
      toast.success(result.message || 'Recording saved successfully')
      return result
    } catch (error: any) {
      console.error('Error saving recording:', error)
      // Only throw if we've exhausted retries
      if (retryCount >= maxRetries) {
        throw error
      }
      // Otherwise, retry
      await new Promise(resolve => setTimeout(resolve, 3000))
      return saveRecordingToStorage(retryCount + 1, maxRetries)
    }
  }

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
      // Stop recording if active before ending call
      if (isRecording && call) {
        try {
          await call.stopRecording()
          setIsRecording(false)
          
          // Wait a bit for recording to be ready, then save
          setTimeout(async () => {
            try {
              await saveRecordingToStorage()
            } catch (error: any) {
              console.error('Error saving recording on call end:', error)
              toast.error(error.message || 'Failed to save recording. You can save it manually from the Recordings page.')
            }
          }, 5000) // Increased delay to 5 seconds to allow recording to process
        } catch (recordingError) {
          console.error('Error stopping recording:', recordingError)
        }
      }

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
          {/* Recording Indicator */}
          {isRecording && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-red-600/90 backdrop-blur-sm px-3 py-1 rounded-full border border-red-500/50">
              <Circle className="h-2 w-2 text-white animate-pulse fill-white" />
              <span className="text-white text-xs font-medium">Recording</span>
            </div>
          )}
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
            {isMobile ? (
              // Mobile: Use swipeable layout (speaker mode includes swipe to grid)
              layout === "speaker" ? (
                <MobileSwipeableLayout
                  ownerId={event.owner_id}
                  call={call}
                  onViewChange={handleMobileViewChange}
                  localScreenShareEnabled={isScreenShareEnabled}
                  localParticipant={localParticipant}
                />
              ) : (
                <CustomGridLayout 
                  ownerId={event.owner_id} 
                  call={call}
                  localScreenShareEnabled={isScreenShareEnabled}
                  localParticipant={localParticipant}
                />
              )
            ) : (
              // Desktop: Use traditional layouts
              layout === "speaker" ? (
                <CustomSpeakerLayout 
                  ownerId={event.owner_id} 
                  call={call}
                  localScreenShareEnabled={isScreenShareEnabled}
                  localParticipant={localParticipant}
                />
              ) : (
                <CustomGridLayout 
                  ownerId={event.owner_id} 
                  call={call}
                  localScreenShareEnabled={isScreenShareEnabled}
                  localParticipant={localParticipant}
                />
              )
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
          {/* Mobile: Equal spacing for all buttons */}
          <div className="h-full flex items-center justify-evenly md:hidden px-1">
            {/* Layout toggle */}
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
                        setLocalMicEnabled(false) // Update local state immediately
                      } else {
                        await call.microphone.enable()
                        setLocalMicEnabled(true) // Update local state immediately
                      }
                    } catch (error: any) {
                      console.error('Could not toggle microphone:', error)
                      // Handle specific GetStream error codes
                      if (error.code === 'ERR_PERMISSION_DENIED') {
                        toast.error('Microphone permission denied')
                      } else if (error.code === 'ERR_DEVICE_NOT_FOUND') {
                        toast.error('Microphone not found')
                      } else {
                        toast.error('Failed to toggle microphone')
                      }
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
                        setLocalCameraEnabled(false) // Update local state immediately
                      } else {
                        await call.camera.enable()
                        setLocalCameraEnabled(true) // Update local state immediately
                      }
                    } catch (error: any) {
                      console.error('Could not toggle camera:', error)
                      // Handle specific GetStream error codes
                      if (error.code === 'ERR_PERMISSION_DENIED') {
                        toast.error('Camera permission denied')
                      } else if (error.code === 'ERR_DEVICE_NOT_FOUND') {
                        toast.error('Camera not found')
                      } else {
                        toast.error('Failed to toggle camera')
                      }
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

            {/* Speaker/Playback toggle */}
            <Button
              variant="ghost"
              size="sm"
                  onClick={async () => {
                    if (isSpeakerLoading) return
                    setIsSpeakerLoading(true)
                    try {
                      if (!speaker) {
                        toast.error('Speaker not available')
                        return
                      }
                      const targetVolume = isSpeakerEnabled ? 0 : (previousSpeakerVolumeRef.current > 0 ? previousSpeakerVolumeRef.current : 1)
                      
                      // Check if speaker has setVolume method
                      if (typeof speaker.setVolume !== 'function') {
                        toast.error('Speaker API not available')
                        return
                      }
                      
                      if (isSpeakerEnabled) {
                        // Store current volume before muting
                        previousSpeakerVolumeRef.current = currentSpeakerVolume
                        await speaker.setVolume(0)
                        setLocalSpeakerVolume(0) // Update local state immediately
                      } else {
                        // Restore previous volume or default to 1
                        const restoreVolume = previousSpeakerVolumeRef.current > 0 ? previousSpeakerVolumeRef.current : 1
                        await speaker.setVolume(restoreVolume)
                        setLocalSpeakerVolume(restoreVolume) // Update local state immediately
                      }
                    } catch (error: any) {
                      toast.error(`Failed to toggle speaker: ${error.message || 'Unknown error'}`)
                    } finally {
                      setIsSpeakerLoading(false)
                    }
                  }}
                  disabled={isSpeakerLoading}
                  className={cn(
                    "h-10 w-10 rounded-full p-0 transition-all duration-200",
                    isSpeakerLoading
                      ? "bg-white/10 text-white cursor-wait"
                      : isSpeakerEnabled
                        ? "bg-white/10 hover:bg-white/20 text-white"
                        : "bg-red-600 hover:bg-red-700 text-white"
                  )}
                  title={isSpeakerEnabled ? "Mute speaker" : "Unmute speaker"}
                >
                  {isSpeakerLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isSpeakerEnabled ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4" />
                  )}
                </Button>

            {/* Recording toggle - Owner only */}
            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (isRecordingLoading) return
                  
                  setIsRecordingLoading(true)
                  try {
                    if (isRecording) {
                      // Stop recording
                      await call.stopRecording()
                      setIsRecording(false)
                      toast.success('Recording stopped')
                      
                      // Automatically save recording after a delay (recording needs time to process)
                      setTimeout(async () => {
                        try {
                          await saveRecordingToStorage()
                        } catch (error: any) {
                          console.error('Error saving recording:', error)
                          toast.error(error.message || 'Failed to save recording automatically. You can save it manually from the Recordings page.')
                        }
                      }, 5000) // Increased delay to 5 seconds to allow recording to process
                    } else {
                      // Check if recording is already active before starting
                      try {
                        const callId = call.id || event.id
                        const checkResponse = await fetch(`/api/recordings/list?callId=${callId}`)
                        
                        if (checkResponse.ok) {
                          const checkData = await checkResponse.json()
                          const recordings = checkData.recordings || []
                          const activeRecording = recordings?.find((r: any) => {
                            const status = r.status || r.state || r.recording_status
                            return status === 'recording' || 
                                   status === 'in_progress' || 
                                   status === 'active' ||
                                   (r.start_time && !r.end_time)
                          })
                          
                          if (activeRecording) {
                            // Recording is already active, just update UI state
                            setIsRecording(true)
                            toast.info('Recording is already active')
                            return
                          }
                        }
                      } catch (checkError) {
                        // If check fails, proceed with starting recording
                        console.error('Error checking recording state:', checkError)
                      }
                      
                      // Start recording
                      await call.startRecording()
                      setIsRecording(true)
                      toast.success('Recording started')
                    }
                  } catch (error: any) {
                    console.error('Error toggling recording:', error)
                    toast.error(error.message || 'Failed to toggle recording')
                  } finally {
                    setIsRecordingLoading(false)
                  }
                }}
                disabled={isRecordingLoading}
                className={cn(
                  "h-10 w-10 rounded-full p-0 transition-all duration-200",
                  isRecordingLoading
                    ? "bg-white/10 text-white cursor-wait"
                    : isRecording
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-white/10 hover:bg-white/20 text-white"
                )}
                title={isRecording ? "Stop recording" : "Start recording"}
              >
                {isRecordingLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isRecording ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Screen Share toggle - Host only */}
            {isOwner && isScreenShareSupported && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                      if (isScreenShareLoading) return
                      
                      // Check browser support for screen sharing
                      if (!isScreenShareEnabled) {
                        if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
                          toast.error('Screen sharing is not supported in this browser. Please use a modern browser with HTTPS.')
                          return
                        }
                        
                        // Check if HTTPS is required (localhost is allowed for development)
                        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                          toast.error('Screen sharing requires HTTPS. Please use a secure connection.')
                          return
                        }
                      }
                      
                      setIsScreenShareLoading(true)
                      try {
                        if (isScreenShareEnabled) {
                          // Stop screen sharing using Stream.io SDK screenShare API
                          // Note: This works fine even if user has no camera device
                          try {
                            if (typeof (call as any).screenShare?.disable === 'function') {
                              await (call as any).screenShare.disable()
                            } else if (typeof (call as any).stopScreenShare === 'function') {
                              await (call as any).stopScreenShare()
                            } else if (typeof (call as any).camera?.stopScreenShare === 'function') {
                              await (call as any).camera.stopScreenShare()
                            } else {
                              // Last resort: disable camera (this will stop screen share if it's active)
                              await call.camera.disable()
                            }
                            setLocalScreenShareEnabled(false)
                            toast.success('Screen sharing stopped')
                          } catch (stopError: any) {
                            // Try to disable camera as fallback
                            try {
                              await call.camera.disable()
                              setLocalScreenShareEnabled(false)
                            } catch {
                              throw stopError
                            }
                          }
                        } else {
                          // According to Stream.io docs: https://getstream.io/video/docs/react/advanced/screensharing/
                          // The SDK handles getDisplayMedia internally, so we just call enable()
                          try {
                            // Use the proper SDK method - it handles getDisplayMedia internally
                            if (typeof (call as any).screenShare?.enable === 'function') {
                              // SDK handles getDisplayMedia internally - no need to call it ourselves
                              await (call as any).screenShare.enable()
                              
                              setLocalScreenShareEnabled(true)
                              toast.success('Screen sharing started')
                              
                              // Monitor screen share state changes (user stops sharing from browser UI)
                              // The SDK automatically handles this, but we can listen for state changes
                              const screenShareState = (call as any).screenShare?.state
                              if (screenShareState && typeof screenShareState.subscribe === 'function') {
                                // Subscribe to state changes to detect when user stops sharing
                                screenShareState.subscribe((state: any) => {
                                  if (state?.status === 'disabled') {
                                    setLocalScreenShareEnabled(false)
                                    toast.info('Screen sharing stopped')
                                  }
                                })
                              }
                            } else {
                              throw new Error('call.screenShare.enable() is not available in this SDK version. Please ensure you are using the latest Stream.io Video SDK.')
                            }
                          } catch (publishError: any) {
                            console.error('[Screen Share] Failed to enable screen sharing:', publishError)
                            throw publishError
                          }
                        }
                      } catch (error: any) {
                        console.error('Could not toggle screen share:', error)
                        // Handle specific GetStream error codes
                        if (error.code === 'ERR_PERMISSION_DENIED' || error.name === 'NotAllowedError') {
                          toast.error('Screen sharing permission denied. Please grant permission in your browser settings.')
                        } else if (error.code === 'ERR_NOT_SUPPORTED' || error.message?.includes('not supported') || error.name === 'NotSupportedError') {
                          toast.error('Screen sharing is not supported on this device/browser')
                        } else if (error.message?.includes('getDisplayMedia') || error.message?.includes('not a function')) {
                          toast.error('Screen sharing is not available. Please use a modern browser with HTTPS connection.')
                          } else if (error.message?.includes('not found in SDK')) {
                            toast.error('Screen sharing feature requires SDK update')
                        } else {
                          toast.error(`Failed to toggle screen share: ${error.message || 'Unknown error'}`)
                        }
                      } finally {
                        setIsScreenShareLoading(false)
                      }
                    }}
                    disabled={isScreenShareLoading}
                    className={cn(
                      "h-10 w-10 rounded-full p-0 transition-all duration-200",
                      isScreenShareLoading
                        ? "bg-white/10 text-white cursor-wait"
                        : isScreenShareEnabled
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : "bg-white/10 hover:bg-white/20 text-white"
                    )}
                    title={isScreenShareEnabled ? "Stop screen sharing" : "Start screen sharing"}
                  >
                    {isScreenShareLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isScreenShareEnabled ? (
                      <MonitorOff className="h-4 w-4" />
                    ) : (
                      <Monitor className="h-4 w-4" />
                    )}
                  </Button>
            )}

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

              {/* Self-view toggle - only show on grid view (mobile or desktop) */}
              {((!isMobile && layout === 'grid') || (isMobile && mobileView === 'grid')) && (
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
            )}
              
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

          {/* Desktop: Grouped layout with center alignment */}
          <div className="hidden md:flex h-full items-center justify-center gap-8 px-1">
            {/* Left: Layout toggle button */}
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

            {/* Center: Primary call controls */}
            <div className="flex items-center gap-2">
              {/* Media controls group */}
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
                        setLocalMicEnabled(false)
                      } else {
                        await call.microphone.enable()
                        setLocalMicEnabled(true)
                      }
                    } catch (error: any) {
                      console.error('Could not toggle microphone:', error)
                      if (error.code === 'ERR_PERMISSION_DENIED') {
                        toast.error('Microphone permission denied')
                      } else if (error.code === 'ERR_DEVICE_NOT_FOUND') {
                        toast.error('Microphone not found')
                      } else {
                        toast.error('Failed to toggle microphone')
                      }
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
                        setLocalCameraEnabled(false)
                      } else {
                        await call.camera.enable()
                        setLocalCameraEnabled(true)
                      }
                    } catch (error: any) {
                      console.error('Could not toggle camera:', error)
                      if (error.code === 'ERR_PERMISSION_DENIED') {
                        toast.error('Camera permission denied')
                      } else if (error.code === 'ERR_DEVICE_NOT_FOUND') {
                        toast.error('Camera not found')
                      } else {
                        toast.error('Failed to toggle camera')
                      }
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

                {/* Speaker/Playback toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (isSpeakerLoading) return
                    setIsSpeakerLoading(true)
                    try {
                      if (!speaker) {
                        toast.error('Speaker not available')
                        return
                      }
                      if (isSpeakerEnabled) {
                        previousSpeakerVolumeRef.current = currentSpeakerVolume
                        await speaker.setVolume(0)
                        setLocalSpeakerVolume(0)
                      } else {
                        const restoreVolume = previousSpeakerVolumeRef.current > 0 ? previousSpeakerVolumeRef.current : 1
                        await speaker.setVolume(restoreVolume)
                        setLocalSpeakerVolume(restoreVolume)
                      }
                    } catch (error: any) {
                      toast.error(`Failed to toggle speaker: ${error.message || 'Unknown error'}`)
                    } finally {
                      setIsSpeakerLoading(false)
                    }
                  }}
                  disabled={isSpeakerLoading}
                  className={cn(
                    "h-10 w-10 rounded-full p-0 transition-all duration-200",
                    isSpeakerLoading
                      ? "bg-white/10 text-white cursor-wait"
                      : isSpeakerEnabled
                        ? "bg-white/10 hover:bg-white/20 text-white"
                        : "bg-red-600 hover:bg-red-700 text-white"
                  )}
                  title={isSpeakerEnabled ? "Mute speaker" : "Unmute speaker"}
                >
                  {isSpeakerLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isSpeakerEnabled ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4" />
                  )}
                </Button>

                {/* Recording toggle - Owner only */}
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (isRecordingLoading) return
                      
                      setIsRecordingLoading(true)
                      try {
                        if (isRecording) {
                          // Stop recording
                          await call.stopRecording()
                          setIsRecording(false)
                          toast.success('Recording stopped')
                          
                          // Automatically save recording after a short delay
                          setTimeout(async () => {
                            try {
                              await saveRecordingToStorage()
                            } catch (error) {
                              console.error('Error saving recording:', error)
                              toast.error('Failed to save recording automatically. You can save it manually from the Recordings page.')
                            }
                          }, 2000)
                        } else {
                          // Start recording
                          await call.startRecording()
                          setIsRecording(true)
                          toast.success('Recording started')
                        }
                      } catch (error: any) {
                        console.error('Error toggling recording:', error)
                        toast.error(error.message || 'Failed to toggle recording')
                      } finally {
                        setIsRecordingLoading(false)
                      }
                    }}
                    disabled={isRecordingLoading}
                    className={cn(
                      "h-10 w-10 rounded-full p-0 transition-all duration-200",
                      isRecordingLoading
                        ? "bg-white/10 text-white cursor-wait"
                        : isRecording
                          ? "bg-red-600 hover:bg-red-700 text-white"
                          : "bg-white/10 hover:bg-white/20 text-white"
                    )}
                    title={isRecording ? "Stop recording" : "Start recording"}
                  >
                    {isRecordingLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isRecording ? (
                      <Square className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </Button>
                )}

                {/* Screen Share toggle - Host only */}
                {isOwner && isScreenShareSupported && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (isScreenShareLoading) return
                      
                      // Check browser support for screen sharing
                      if (!isScreenShareEnabled) {
                        if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
                          toast.error('Screen sharing is not supported in this browser. Please use a modern browser with HTTPS.')
                          return
                        }
                        
                        // Check if HTTPS is required (localhost is allowed for development)
                        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                          toast.error('Screen sharing requires HTTPS. Please use a secure connection.')
                          return
                        }
                      }
                      
                      setIsScreenShareLoading(true)
                      try {
                        if (isScreenShareEnabled) {
                          if (typeof (call as any).screenShare?.disable === 'function') {
                            await (call as any).screenShare.disable()
                          } else if (typeof (call as any).disableScreenShare === 'function') {
                            await (call as any).disableScreenShare()
                          } else if (typeof (call as any).stopScreenShare === 'function') {
                            await (call as any).stopScreenShare()
                          } else {
                            throw new Error('Screen share disable method not found in SDK')
                          }
                          setLocalScreenShareEnabled(false)
                          toast.success('Screen sharing stopped')
                        } else {
                          if (typeof (call as any).screenShare?.enable === 'function') {
                            await (call as any).screenShare.enable()
                          } else if (typeof (call as any).enableScreenShare === 'function') {
                            await (call as any).enableScreenShare()
                          } else if (typeof (call as any).startScreenShare === 'function') {
                            await (call as any).startScreenShare()
                          } else {
                            throw new Error('Screen share enable method not found in SDK')
                          }
                          setLocalScreenShareEnabled(true)
                          toast.success('Screen sharing started')
                        }
                      } catch (error: any) {
                        console.error('Could not toggle screen share:', error)
                        if (error.code === 'ERR_PERMISSION_DENIED' || error.name === 'NotAllowedError') {
                          toast.error('Screen sharing permission denied. Please grant permission in your browser settings.')
                        } else if (error.code === 'ERR_NOT_SUPPORTED' || error.message?.includes('not supported') || error.name === 'NotSupportedError') {
                          toast.error('Screen sharing is not supported on this device/browser')
                        } else if (error.message?.includes('getDisplayMedia') || error.message?.includes('not a function')) {
                          toast.error('Screen sharing is not available. Please use a modern browser with HTTPS connection.')
                          } else if (error.message?.includes('not found in SDK')) {
                            toast.error('Screen sharing feature requires SDK update')
                        } else {
                          toast.error(`Failed to toggle screen share: ${error.message || 'Unknown error'}`)
                        }
                      } finally {
                        setIsScreenShareLoading(false)
                      }
                    }}
                    disabled={isScreenShareLoading}
                    className={cn(
                      "h-10 w-10 rounded-full p-0 transition-all duration-200",
                      isScreenShareLoading
                        ? "bg-white/10 text-white cursor-wait"
                        : isScreenShareEnabled
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : "bg-white/10 hover:bg-white/20 text-white"
                    )}
                    title={isScreenShareEnabled ? "Stop screen sharing" : "Start screen sharing"}
                  >
                    {isScreenShareLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isScreenShareEnabled ? (
                      <MonitorOff className="h-4 w-4" />
                    ) : (
                      <Monitor className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>

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

            {/* Right: Secondary controls */}
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

              {/* Self-view toggle - only show on grid view */}
              {layout === 'grid' && (
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
              )}
              
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
        <SettingsDialog
          open={showSettingsDialog}
          onOpenChange={setShowSettingsDialog}
          call={call}
          isMicEnabled={isMicEnabled}
          isCameraEnabled={isCameraEnabled}
          isMicLoading={isMicLoading}
          setIsMicLoading={setIsMicLoading}
          isCameraLoading={isCameraLoading}
          setIsCameraLoading={setIsCameraLoading}
          hasMicDevice={hasMicDevice}
          hasCameraDevice={hasCameraDevice}
          micDevices={micDevices}
          cameraDevices={cameraDevices}
          selectedMicId={selectedMicId}
          setSelectedMicId={setSelectedMicId}
                  selectedCameraId={selectedCameraId}
        setSelectedCameraId={setSelectedCameraId}
        micSensitivity={micSensitivity}
        setMicSensitivity={setMicSensitivity}
        refreshDevices={refreshDevices}
        />
    </div>
  )
}