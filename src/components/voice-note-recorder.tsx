"use client"

import * as React from "react"
import { Mic, Square, Pause, Play, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface VoiceNoteRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void
  onCancel: () => void
  maxDurationMinutes?: number
  autoStart?: boolean
}

const MAX_DURATION_MS = 5 * 60 * 1000 // 5 minutes default

export function VoiceNoteRecorder({
  onRecordingComplete,
  onCancel,
  maxDurationMinutes = 5,
  autoStart = false
}: VoiceNoteRecorderProps) {
  const [isRecording, setIsRecording] = React.useState(false)
  const [isPaused, setIsPaused] = React.useState(false)
  const [elapsedTime, setElapsedTime] = React.useState(0)
  const [recordingComplete, setRecordingComplete] = React.useState(false)
  
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const audioChunksRef = React.useRef<Blob[]>([])
  const streamRef = React.useRef<MediaStream | null>(null)
  const timerIntervalRef = React.useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = React.useRef<number>(0)
  const pausedTimeRef = React.useRef<number>(0)
  const isCancelledRef = React.useRef<boolean>(false)

  const maxDuration = maxDurationMinutes * 60 * 1000

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getRemainingTime = () => {
    return Math.max(0, maxDuration - elapsedTime)
  }

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      mediaRecorderRef.current = mediaRecorder

      audioChunksRef.current = []
      isCancelledRef.current = false

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        // Only complete the recording if it wasn't cancelled
        if (!isCancelledRef.current) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          onRecordingComplete(audioBlob)
          setRecordingComplete(true)
        }
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setIsPaused(false)
      startTimeRef.current = Date.now() - pausedTimeRef.current
      pausedTimeRef.current = 0

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        const now = Date.now()
        const elapsed = now - startTimeRef.current
        setElapsedTime(elapsed)

        // Check if we've reached the limit
        if (elapsed >= maxDuration) {
          stopRecording()
        }
      }, 100)
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Failed to access microphone. Please check permissions.')
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      stopTimer()
      pausedTimeRef.current = Date.now() - startTimeRef.current
    }
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
      startTimeRef.current = Date.now() - pausedTimeRef.current
      
      // Resume timer
      timerIntervalRef.current = setInterval(() => {
        const now = Date.now()
        const elapsed = now - startTimeRef.current
        setElapsedTime(elapsed)

        if (elapsed >= maxDuration) {
          stopRecording()
        }
      }, 100)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Not cancelled - this is a normal stop
      isCancelledRef.current = false
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
      stopTimer()
    }
  }

  const handleCancel = () => {
    // Mark as cancelled before stopping
    isCancelledRef.current = true
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    stopTimer()
    setIsRecording(false)
    setIsPaused(false)
    setElapsedTime(0)
    setRecordingComplete(false)
    onCancel()
  }

  React.useEffect(() => {
    return () => {
      stopTimer()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Auto-start recording if requested
  React.useEffect(() => {
    if (autoStart && !isRecording && !recordingComplete && mediaRecorderRef.current === null) {
      startRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart])

  const remainingTime = getRemainingTime()
  const isNearLimit = remainingTime < 60000 // Less than 1 minute
  const warningThresholds = [
    { time: 60000, text: "1 minute remaining" },
    { time: 30000, text: "30 seconds remaining" },
    { time: 10000, text: "10 seconds remaining" }
  ]
  const currentWarning = warningThresholds.find(w => remainingTime <= w.time && remainingTime > w.time - 5000)

  return (
    <div className="bg-white/10 border border-white/20 rounded-lg p-3">
      {/* Single Row: Times, Status, Controls, Cancel */}
      <div className="flex items-center gap-2">
        {/* Recording Indicator */}
        {isRecording && !isPaused && (
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
        )}

        {/* Time Recorded */}
        <div className="font-mono text-sm text-white/80">
          {formatTime(elapsedTime)}
        </div>

        {/* Pause Status */}
        {isPaused && (
          <>
            <div className="text-white/40">•</div>
            <span className="text-xs text-white/60">Paused</span>
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Control Buttons */}
        <div className="flex items-center gap-2">
          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={recordingComplete}
              className="flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
            >
              <Mic className="h-4 w-4 text-white/70 hover:text-white/80 transition-all" />
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  type="button"
                  onClick={resumeRecording}
                  className="flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
                >
                  <Play className="h-4 w-4 text-white/70 hover:text-white/80 transition-all" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={pauseRecording}
                  className="flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
                >
                  <Pause className="h-4 w-4 text-white/70 hover:text-white/80 transition-all" />
                </button>
              )}
              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
              >
                <Square className="h-4 w-4 text-white/70 hover:text-white/80 transition-all" />
              </button>
            </>
          )}
        </div>

        {/* Cancel/Delete Button */}
        <button
          type="button"
          onClick={handleCancel}
          className="flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30 flex-shrink-0"
        >
          {isRecording || recordingComplete ? (
            <Trash2 className="h-4 w-4 text-white/70 hover:text-white/80 transition-all" />
          ) : (
            <X className="h-4 w-4 text-white/70 hover:text-white/80 transition-all" />
          )}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden mt-2">
        <div
          className={cn(
            "h-full transition-all duration-100",
            isNearLimit ? "bg-yellow-400" : "bg-white/60"
          )}
          style={{ width: `${Math.min(100, (elapsedTime / maxDuration) * 100)}%` }}
        />
      </div>
    </div>
  )
}

