"use client"

import React from "react"
import { Mic, Video, Loader2, Volume2, VolumeX } from "lucide-react"
import { type Call, useCallStateHooks } from "@stream-io/video-react-sdk"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { MicrophoneVisualizer, CameraPreview } from "./media-previews"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  call: Call
  isMicEnabled: boolean
  isCameraEnabled: boolean
  isMicLoading: boolean
  setIsMicLoading: (loading: boolean) => void
  isCameraLoading: boolean
  setIsCameraLoading: (loading: boolean) => void
  hasMicDevice: boolean
  hasCameraDevice: boolean
  micDevices: MediaDeviceInfo[]
  cameraDevices: MediaDeviceInfo[]
  selectedMicId: string
  setSelectedMicId: (id: string) => void
  selectedCameraId: string
  setSelectedCameraId: (id: string) => void
  micSensitivity: number
  setMicSensitivity: (value: number) => void
  refreshDevices?: () => Promise<void>
}

/**
 * Settings Dialog Component
 * Allows users to configure microphone, camera, and playback settings
 */
export function SettingsDialog({
  open,
  onOpenChange,
  call,
  isMicEnabled: propIsMicEnabled,
  isCameraEnabled: propIsCameraEnabled,
  isMicLoading,
  setIsMicLoading,
  isCameraLoading,
  setIsCameraLoading,
  hasMicDevice,
  hasCameraDevice,
  micDevices,
  cameraDevices,
  selectedMicId,
  setSelectedMicId,
  selectedCameraId,
  setSelectedCameraId,
  micSensitivity,
  setMicSensitivity,
  refreshDevices,
}: SettingsDialogProps) {
  // Use Stream SDK's speaker state hook (must be inside StreamCall context)
  // Note: SettingsDialog must be rendered inside StreamCall component
  const { useSpeakerState } = useCallStateHooks()
  const { speaker, selectedDevice, devices: streamSpeakerDevices = [], isDeviceSelectionSupported = false } = useSpeakerState()
  
  // Use local state to track mic/camera status for immediate UI updates
  const [localMicEnabled, setLocalMicEnabled] = React.useState<boolean>(propIsMicEnabled)
  const [localCameraEnabled, setLocalCameraEnabled] = React.useState<boolean>(propIsCameraEnabled)
  
  // Sync local state with props when they change
  React.useEffect(() => {
    setLocalMicEnabled(propIsMicEnabled)
  }, [propIsMicEnabled])
  
  React.useEffect(() => {
    setLocalCameraEnabled(propIsCameraEnabled)
  }, [propIsCameraEnabled])
  
  const isMicEnabled = localMicEnabled
  const isCameraEnabled = localCameraEnabled
  // Use local state to track volume since Stream SDK's reactive state may not update immediately
  // Access volume through type assertion since Stream SDK types may not expose it directly
  const speakerVolume = (speaker as any)?.volume ?? 1
  const [localSpeakerVolume, setLocalSpeakerVolume] = React.useState<number>(speakerVolume)
  const [isSpeakerLoading, setIsSpeakerLoading] = React.useState(false)
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
  
  // Also manually enumerate devices to get full list (Stream may only return selected device)
  const [allSpeakerDevices, setAllSpeakerDevices] = React.useState<MediaDeviceInfo[]>([])
  
  const enumerateSpeakerDevices = React.useCallback(async () => {
    try {
      // Some browsers require audio permission to get device labels
      // We'll try to get permission, but continue even if it fails
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (permError) {
        // Permission denied or not needed, continue anyway
        console.log('[Playback] Audio permission not available (may affect device labels):', permError)
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput')
      setAllSpeakerDevices(audioOutputs)
      console.log('[Playback] Enumerated speaker devices:', audioOutputs.map(d => ({ id: d.deviceId, label: d.label || 'Unknown device' })))
    } catch (error) {
      console.error('[Playback] Error enumerating speaker devices:', error)
    }
  }, [])
  
  // Prefer manually enumerated devices (full list), but use Stream's if that's all we have
  // Stream may only return the currently selected device, so manual enumeration gives us the full list
  const speakerDevices = allSpeakerDevices.length > 0 ? allSpeakerDevices : streamSpeakerDevices
  const selectedSpeakerId = selectedDevice || ''
  const hasSpeakerDevice = speakerDevices.length > 0
  
  // Log what we found
  React.useEffect(() => {
    if (open && speakerDevices.length > 0) {
      console.log('[Playback] Available speaker devices:', speakerDevices.map(d => ({ id: d.deviceId, label: d.label, selected: d.deviceId === selectedSpeakerId })))
    }
  }, [open, speakerDevices, selectedSpeakerId])
  
  // Enumerate devices when dialog opens or playback tab might be viewed
  React.useEffect(() => {
    if (open) {
      enumerateSpeakerDevices()
    }
  }, [open, enumerateSpeakerDevices])
  
  // Also refresh when refreshDevices callback changes (will be called from parent)
  // Note: We don't want to depend on refreshDevices itself as it may change frequently
  const [isTestingSound, setIsTestingSound] = React.useState(false)
  const audioContextRef = React.useRef<AudioContext | null>(null)
  const audioElementRef = React.useRef<HTMLAudioElement | null>(null)
  const cleanupTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Cleanup audio on unmount or dialog close
  React.useEffect(() => {
    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current)
        cleanupTimeoutRef.current = null
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause()
        audioElementRef.current.srcObject = null
        audioElementRef.current = null
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [])

  // Stop sound test when dialog closes
  React.useEffect(() => {
    if (!open) {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current)
        cleanupTimeoutRef.current = null
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause()
        audioElementRef.current.srcObject = null
        audioElementRef.current = null
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      setIsTestingSound(false)
    }
  }, [open])

  // Refresh devices when playback tab might be viewed (when dialog opens)
  React.useEffect(() => {
    if (open && refreshDevices) {
      // Small delay to ensure dialog is fully rendered
      const timer = setTimeout(() => {
        refreshDevices()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [open, refreshDevices])

  const handleTestSound = React.useCallback(async () => {
    if (isTestingSound) {
      // Stop the test
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current)
        cleanupTimeoutRef.current = null
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause()
        audioElementRef.current.srcObject = null
        audioElementRef.current = null
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close()
        audioContextRef.current = null
      }
      setIsTestingSound(false)
      return
    }

    try {
      setIsTestingSound(true)

      // Create audio context for generating test melody
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) {
        throw new Error('Web Audio API not supported')
      }

      audioContextRef.current = new AudioContextClass()
      
      // Für Elise melody (simplified opening phrase)
      // Notes: E5, D#5, E5, D#5, E5, B4, D5, C5, A4
      // Frequencies in Hz (equal temperament)
      const noteFrequencies: { [key: string]: number } = {
        'A4': 440.00,
        'B4': 493.88,
        'C5': 523.25,
        'D5': 587.33,
        'D#5': 622.25,
        'E5': 659.25,
      }

      // Für Elise opening melody with timing (in seconds)
      const melody = [
        { note: 'E5', duration: 0.15 },
        { note: 'D#5', duration: 0.15 },
        { note: 'E5', duration: 0.15 },
        { note: 'D#5', duration: 0.15 },
        { note: 'E5', duration: 0.15 },
        { note: 'B4', duration: 0.15 },
        { note: 'D5', duration: 0.15 },
        { note: 'C5', duration: 0.15 },
        { note: 'A4', duration: 0.3 },
        { note: 'C4', duration: 0.15 },
        { note: 'E4', duration: 0.15 },
        { note: 'A4', duration: 0.15 },
        { note: 'B4', duration: 0.3 },
        { note: 'E4', duration: 0.15 },
        { note: 'G#4', duration: 0.15 },
        { note: 'B4', duration: 0.15 },
        { note: 'C5', duration: 0.3 },
      ]

      // Add missing note frequencies
      noteFrequencies['C4'] = 261.63
      noteFrequencies['E4'] = 329.63
      noteFrequencies['G#4'] = 415.30

      const mediaStreamDestination = audioContextRef.current.createMediaStreamDestination()
      const masterGain = audioContextRef.current.createGain()
      masterGain.gain.value = 0.15 // Volume control
      masterGain.connect(mediaStreamDestination)

      // Schedule notes
      let currentTime = audioContextRef.current.currentTime + 0.1 // Small delay
      
      melody.forEach(({ note, duration }) => {
        const frequency = noteFrequencies[note]
        if (!frequency) return

        const oscillator = audioContextRef.current!.createOscillator()
        const gainNode = audioContextRef.current!.createGain()

        oscillator.type = 'sine'
        oscillator.frequency.value = frequency

        // Envelope for smooth attack/release
        gainNode.gain.setValueAtTime(0, currentTime)
        gainNode.gain.linearRampToValueAtTime(0.3, currentTime + 0.01)
        gainNode.gain.setValueAtTime(0.3, currentTime + duration - 0.05)
        gainNode.gain.linearRampToValueAtTime(0, currentTime + duration)

        oscillator.connect(gainNode)
        gainNode.connect(masterGain)
        
        oscillator.start(currentTime)
        oscillator.stop(currentTime + duration)
        
        currentTime += duration
      })

      // Store reference for cleanup
      const totalDuration = melody.reduce((sum, { duration }) => sum + duration, 0)

      // Create audio element that can use setSinkId for device-specific routing
      const audioElement = new Audio()
      
      // Try to set the audio output device if supported
      if (selectedSpeakerId && 'setSinkId' in HTMLAudioElement.prototype) {
        try {
          await (audioElement as any).setSinkId(selectedSpeakerId)
        } catch (error) {
          console.warn('Could not set sink ID:', error)
          // Fall back to default device
        }
      }

      // Set audio source to the media stream
      audioElement.srcObject = mediaStreamDestination.stream
      audioElement.volume = 1.0

      audioElementRef.current = audioElement

      // Handle cleanup after melody finishes
      const handleEnded = () => {
        setIsTestingSound(false)
        if (audioElementRef.current) {
          audioElementRef.current.pause()
          audioElementRef.current.srcObject = null
          audioElementRef.current = null
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close()
          audioContextRef.current = null
        }
        audioElement.removeEventListener('ended', handleEnded)
      }

      // Set up timeout to cleanup after melody completes (with small buffer)
      cleanupTimeoutRef.current = setTimeout(() => {
        handleEnded()
      }, (totalDuration + 0.5) * 1000)

      // Play the audio
      await audioElement.play()

      // Refresh devices after playing audio - some browsers only expose output devices after audio interaction
      setTimeout(() => {
        enumerateSpeakerDevices()
        if (refreshDevices) {
          refreshDevices()
        }
      }, (totalDuration + 0.5) * 1000)
    } catch (error: any) {
      console.error('Error testing sound:', error)
      toast.error('Failed to test sound')
      setIsTestingSound(false)
    }
  }, [isTestingSound, selectedSpeakerId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-white/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-semibold">Settings</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="microphone" className="w-full mt-6">
          <TabsList className="flex w-full sm:grid sm:grid-cols-3 gap-1">
            <TabsTrigger value="microphone" className="flex items-center gap-2 shrink-0 min-w-fit">
              <Mic className="h-4 w-4" />
              <span>Microphone</span>
            </TabsTrigger>
            <TabsTrigger value="camera" className="flex items-center gap-2 shrink-0 min-w-fit">
              <Video className="h-4 w-4" />
              <span>Camera</span>
            </TabsTrigger>
            <TabsTrigger value="playback" className="flex items-center gap-2 shrink-0 min-w-fit">
              <Volume2 className="h-4 w-4" />
              <span>Playback</span>
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
                      try {
                        setSelectedMicId(deviceId)
                        // Apply device change to active call
                        if (isMicEnabled) {
                          await call.microphone.disable()
                          await call.microphone.select(deviceId)
                          await call.microphone.enable()
                        } else {
                          await call.microphone.select(deviceId)
                        }
                        toast.success('Microphone device changed')
                      } catch (error: any) {
                        console.error('Failed to switch microphone device:', error)
                        toast.error('Failed to switch microphone device')
                      }
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
                      try {
                        setSelectedCameraId(deviceId)
                        // Apply device change to active call
                        if (isCameraEnabled) {
                          await call.camera.disable()
                          await call.camera.select(deviceId)
                          await call.camera.enable()
                        } else {
                          await call.camera.select(deviceId)
                        }
                        toast.success('Camera device changed')
                      } catch (error: any) {
                        console.error('Failed to switch camera device:', error)
                        toast.error('Failed to switch camera device')
                      }
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

          <TabsContent value="playback" className="mt-4 space-y-4">
            <div className="space-y-3">
              {/* Status and Enable/Disable */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center gap-3">
                  {isSpeakerEnabled ? (
                    <Volume2 className="h-5 w-5 text-white/70" />
                  ) : (
                    <VolumeX className="h-5 w-5 text-white/70" />
                  )}
                  <div>
                    <p className="text-white font-medium text-sm">Playback Status</p>
                    <p className="text-white/60 text-xs">
                      {isSpeakerEnabled ? "Enabled" : "Muted"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    console.log('[Settings Speaker Toggle] Button clicked', { isSpeakerLoading, isSpeakerEnabled, currentSpeakerVolume, speaker: !!speaker })
                    if (isSpeakerLoading) {
                      console.log('[Settings Speaker Toggle] Already loading, skipping')
                      return
                    }
                    setIsSpeakerLoading(true)
                    try {
                      if (!speaker) {
                        console.error('[Settings Speaker Toggle] Speaker object not available')
                        toast.error('Speaker not available')
                        return
                      }
                      
                      // Check if speaker has setVolume method
                      if (typeof speaker.setVolume !== 'function') {
                        console.error('[Settings Speaker Toggle] speaker.setVolume is not a function', speaker)
                        toast.error('Speaker API not available')
                        return
                      }
                      
                      if (isSpeakerEnabled) {
                        // Store current volume before muting
                        previousSpeakerVolumeRef.current = currentSpeakerVolume
                        await speaker.setVolume(0)
                        setLocalSpeakerVolume(0) // Update local state immediately
                        console.log('[Settings Speaker Toggle] Volume set to 0 (muted)')
                      } else {
                        // Restore previous volume or default to 1
                        const restoreVolume = previousSpeakerVolumeRef.current > 0 ? previousSpeakerVolumeRef.current : 1
                        await speaker.setVolume(restoreVolume)
                        setLocalSpeakerVolume(restoreVolume) // Update local state immediately
                        console.log('[Settings Speaker Toggle] Volume restored to', restoreVolume)
                      }
                    } catch (error: any) {
                      console.error('[Settings Speaker Toggle] Error toggling speaker:', error)
                      toast.error(`Failed to toggle speaker: ${error.message || 'Unknown error'}`)
                    } finally {
                      setIsSpeakerLoading(false)
                    }
                  }}
                  disabled={isSpeakerLoading}
                  className={cn(
                    "h-8 px-3 text-xs",
                    isSpeakerEnabled
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-white/10 hover:bg-white/20 text-white"
                  )}
                >
                  {isSpeakerLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isSpeakerEnabled ? (
                    "Mute"
                  ) : (
                    "Unmute"
                  )}
                </Button>
              </div>
              
              {/* Device Selection */}
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white font-medium text-sm">Speaker Selection</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      // Trigger device refresh
                      try {
                        const devices = await navigator.mediaDevices.enumerateDevices()
                        const audioOutputs = devices.filter(device => device.kind === 'audiooutput')
                        setAllSpeakerDevices(audioOutputs)
                        
                        if (refreshDevices) {
                          await refreshDevices()
                        }
                        
                        if (audioOutputs.length > 0) {
                          toast.success(`Found ${audioOutputs.length} speaker device(s)`)
                        } else {
                          toast.info('No speaker devices found. Try playing test sound first.')
                        }
                      } catch (error) {
                        console.error('[Refresh] Error:', error)
                        toast.error('Failed to refresh devices')
                      }
                    }}
                    className="h-6 px-2 text-xs text-white/70 hover:text-white hover:bg-white/10"
                  >
                    Refresh
                  </Button>
                </div>
                {speakerDevices.length > 0 ? (
                  <Select
                    value={selectedSpeakerId || speakerDevices[0]?.deviceId || ''}
                    onValueChange={async (deviceId) => {
                      try {
                        if (!speaker) {
                          toast.error('Speaker not available')
                          return
                        }
                        // Use Stream SDK's speaker.select() method
                        await speaker.select(deviceId)
                        const device = speakerDevices.find(d => d.deviceId === deviceId)
                        toast.success(`Speaker set to: ${device?.label || deviceId || 'Selected device'}`)
                      } catch (error: any) {
                        console.error('Failed to switch speaker device:', error)
                        toast.error('Failed to change speaker device')
                      }
                    }}
                    disabled={!hasSpeakerDevice}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select speaker">
                        {speakerDevices.find(d => d.deviceId === selectedSpeakerId)?.label || 
                         speakerDevices[0]?.label || 
                         'Select speaker'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {speakerDevices.map((device) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || `Speaker ${speakerDevices.indexOf(device) + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-2">
                    {!isDeviceSelectionSupported ? (
                      <>
                        <p className="text-white/60 text-xs">Speaker selection not supported</p>
                        <p className="text-white/40 text-xs">
                          Your browser doesn't support selecting audio output devices. The default system speaker will be used.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-white/60 text-xs">No speaker devices detected</p>
                        <p className="text-white/40 text-xs">
                          Audio output devices may not be available until after playing audio. 
                          Try clicking "Play Test Sound" first, then refresh.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              {/* Test Sound Button */}
              {hasSpeakerDevice && (
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <p className="text-white font-medium text-sm mb-3">Test Sound</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleTestSound}
                    disabled={!hasSpeakerDevice}
                    className={cn(
                      "w-full h-9 text-xs",
                      isTestingSound
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-white/10 hover:bg-white/20 text-white"
                    )}
                  >
                    {isTestingSound ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-2" />
                        Playing test tone...
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3 w-3 mr-2" />
                        Play Test Sound
                      </>
                    )}
                  </Button>
                  <p className="text-white/50 text-xs mt-2">
                    Play a test tone to verify your speaker is working
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}