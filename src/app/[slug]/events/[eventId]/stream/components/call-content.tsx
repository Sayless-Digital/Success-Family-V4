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
} from "lucide-react"
import { StreamCall, type Call, useCallStateHooks } from "@stream-io/video-react-sdk"
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
      console.log('[Device Change Detected]')
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
  speakerDevices,
  selectedSpeakerId,
  setSelectedSpeakerId,
  hasSpeakerDevice,
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
  const { useMicrophoneState, useCameraState, useSpeakerState } = useCallStateHooks()
  const { microphone } = useMicrophoneState()
  const { camera } = useCameraState()
  const { speaker } = useSpeakerState()
  
  // Use local state to track mic/camera status since Stream SDK's reactive state may not update immediately
  const [localMicEnabled, setLocalMicEnabled] = React.useState<boolean>(microphone?.status === 'enabled')
  const [localCameraEnabled, setLocalCameraEnabled] = React.useState<boolean>(camera?.status === 'enabled')
  
  // Update local state when Stream SDK state changes
  React.useEffect(() => {
    if (microphone?.status !== undefined) {
      setLocalMicEnabled(microphone.status === 'enabled')
    }
  }, [microphone?.status])
  
  React.useEffect(() => {
    if (camera?.status !== undefined) {
      setLocalCameraEnabled(camera.status === 'enabled')
    }
  }, [camera?.status])
  
  const isMicEnabled = localMicEnabled
  const isCameraEnabled = localCameraEnabled
  // Track speaker enabled state (volume > 0)
  // Use local state to track volume since Stream SDK's reactive state may not update immediately
  const [localSpeakerVolume, setLocalSpeakerVolume] = React.useState<number>(speaker?.volume ?? 1)
  const previousSpeakerVolumeRef = React.useRef<number>(1) // Store previous volume for unmute
  
  // Update local volume when speaker volume changes (sync with Stream SDK)
  React.useEffect(() => {
    if (speaker?.volume !== undefined && speaker.volume !== localSpeakerVolume) {
      setLocalSpeakerVolume(speaker.volume)
      if (speaker.volume > 0) {
        previousSpeakerVolumeRef.current = speaker.volume
      }
    }
  }, [speaker?.volume])
  
  const currentSpeakerVolume = localSpeakerVolume
  const isSpeakerEnabled = currentSpeakerVolume > 0
  // Note: hasSpeakerDevice comes from props, speakers are always available as output device

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
            {isMobile ? (
              // Mobile: Use swipeable layout (speaker mode includes swipe to grid)
              layout === "speaker" ? (
                <MobileSwipeableLayout
                  ownerId={event.owner_id}
                  call={call}
                  onViewChange={handleMobileViewChange}
                />
              ) : (
                <CustomGridLayout ownerId={event.owner_id} call={call} />
              )
            ) : (
              // Desktop: Use traditional layouts
              layout === "speaker" ? (
                <CustomSpeakerLayout ownerId={event.owner_id} call={call} />
              ) : (
                <CustomGridLayout ownerId={event.owner_id} call={call} />
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
                    console.log('[Speaker Toggle] Button clicked', { isSpeakerLoading, isSpeakerEnabled, currentSpeakerVolume, speaker: !!speaker })
                    if (isSpeakerLoading) {
                      console.log('[Speaker Toggle] Already loading, skipping')
                      return
                    }
                    setIsSpeakerLoading(true)
                    try {
                      if (!speaker) {
                        console.error('[Speaker Toggle] Speaker object not available')
                        toast.error('Speaker not available')
                        return
                      }
                      const targetVolume = isSpeakerEnabled ? 0 : (previousSpeakerVolumeRef.current > 0 ? previousSpeakerVolumeRef.current : 1)
                      console.log('[Speaker Toggle] Setting volume to', targetVolume, 'from', currentSpeakerVolume)
                      
                      // Check if speaker has setVolume method
                      if (typeof speaker.setVolume !== 'function') {
                        console.error('[Speaker Toggle] speaker.setVolume is not a function', speaker)
                        toast.error('Speaker API not available')
                        return
                      }
                      
                      if (isSpeakerEnabled) {
                        // Store current volume before muting
                        previousSpeakerVolumeRef.current = currentSpeakerVolume
                        await speaker.setVolume(0)
                        setLocalSpeakerVolume(0) // Update local state immediately
                        console.log('[Speaker Toggle] Volume set to 0 (muted)')
                      } else {
                        // Restore previous volume or default to 1
                        const restoreVolume = previousSpeakerVolumeRef.current > 0 ? previousSpeakerVolumeRef.current : 1
                        await speaker.setVolume(restoreVolume)
                        setLocalSpeakerVolume(restoreVolume) // Update local state immediately
                        console.log('[Speaker Toggle] Volume restored to', restoreVolume)
                      }
                    } catch (error: any) {
                      console.error('[Speaker Toggle] Error toggling speaker:', error)
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