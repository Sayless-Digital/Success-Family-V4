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
  Phone,
  LogOut,
  PhoneOff,
  Loader2,
  Settings,
  Minimize2,
  PictureInPicture2,
  Users,
} from "lucide-react"
import { StreamCall, type Call } from "@stream-io/video-react-sdk"
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
  const router = useRouter()

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
                        setIsMicEnabled(false)
                      } else {
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
          setIsMicEnabled={setIsMicEnabled}
          isCameraEnabled={isCameraEnabled}
          setIsCameraEnabled={setIsCameraEnabled}
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
        />
      </div>
    </StreamCall>
  )
}