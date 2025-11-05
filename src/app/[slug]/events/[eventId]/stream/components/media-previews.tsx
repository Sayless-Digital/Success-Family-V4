"use client"

import React from "react"

/**
 * Microphone Visualizer Component
 * Shows real-time audio level visualization
 */
export function MicrophoneVisualizer({ deviceId }: { deviceId: string }) {
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
      <div className="h-2 flex-1 bg-white/20 rounded-full overflow-visible">
        <div
          ref={barRef}
          className="h-full bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.6),0_0_16px_rgba(255,255,255,0.4)]"
          style={{ width: '0%', transition: 'none' }}
        />
      </div>
      <p className="text-white/60 text-xs">Active</p>
    </div>
  )
}

/**
 * Camera Preview Component for Settings Dialog
 * Shows live camera feed preview
 */
export function CameraPreview({ deviceId, enabled }: { deviceId: string; enabled: boolean }) {
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