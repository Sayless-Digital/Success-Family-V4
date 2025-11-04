"use client"

import React from "react"
import { Mic, Video, Loader2 } from "lucide-react"
import { type Call } from "@stream-io/video-react-sdk"
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
  setIsMicEnabled: (enabled: boolean) => void
  isCameraEnabled: boolean
  setIsCameraEnabled: (enabled: boolean) => void
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
}

/**
 * Settings Dialog Component
 * Allows users to configure microphone and camera settings
 */
export function SettingsDialog({
  open,
  onOpenChange,
  call,
  isMicEnabled,
  setIsMicEnabled,
  isCameraEnabled,
  setIsCameraEnabled,
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
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
  )
}