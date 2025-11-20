"use client"

import * as React from "react"
import { Play, Pause } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface VoiceNotePlayerProps {
  audioUrl: string
  attachmentId: string
  senderId?: string
  senderAvatar?: string | null
  senderInitials: string
  senderName: string
  isPlaying?: boolean
  onPlayStateChange?: (attachmentId: string, isPlaying: boolean) => void
  onStopOthers?: (currentId: string) => void
  className?: string
}

export function VoiceNotePlayer({
  audioUrl,
  attachmentId,
  senderId,
  senderAvatar,
  senderInitials,
  senderName,
  isPlaying: controlledIsPlaying,
  onPlayStateChange,
  onStopOthers,
  className
}: VoiceNotePlayerProps) {
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [audioProgress, setAudioProgress] = React.useState({ current: 0, duration: 0 })
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const onPlayStateChangeRef = React.useRef(onPlayStateChange)
  const attachmentIdRef = React.useRef(attachmentId)

  // Keep refs in sync with latest values
  React.useEffect(() => {
    onPlayStateChangeRef.current = onPlayStateChange
    attachmentIdRef.current = attachmentId
  }, [onPlayStateChange, attachmentId])

  const playing = controlledIsPlaying !== undefined ? controlledIsPlaying : isPlaying

  const formatAudioTime = React.useCallback((seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  // Initialize audio element only when URL changes
  React.useEffect(() => {
    if (!audioUrl) return

    // Clean up previous audio if URL changed
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }

    const audio = new Audio(audioUrl)
    audioRef.current = audio

    audio.addEventListener('loadedmetadata', () => {
      setAudioProgress(prev => ({
        ...prev,
        duration: audio.duration || 0
      }))
    })

    audio.addEventListener('timeupdate', () => {
      // Update progress while playing
      setAudioProgress(prev => ({
        current: audio.currentTime,
        duration: prev.duration || audio.duration || 0
      }))
    })

    audio.addEventListener('ended', () => {
      setIsPlaying(false)
      onPlayStateChangeRef.current?.(attachmentIdRef.current, false)
      setAudioProgress(prev => ({
        current: 0,
        duration: prev.duration || 0
      }))
    })

    audio.addEventListener('pause', () => {
      // Update progress one last time when paused to preserve position
      setAudioProgress(prev => ({
        current: audio.currentTime,
        duration: prev.duration || audio.duration || 0
      }))
      // Only update state if audio ended
      if (audio.ended) {
        setIsPlaying(false)
        onPlayStateChangeRef.current?.(attachmentIdRef.current, false)
      }
    })

    // Load metadata without resetting position if already loaded
    if (audio.readyState === 0) {
      audio.load()
    }

    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [audioUrl]) // Only depend on audioUrl, not callbacks

  // Sync controlled playing state
  React.useEffect(() => {
    if (controlledIsPlaying !== undefined && audioRef.current) {
      if (controlledIsPlaying && audioRef.current.paused) {
        // Resume from current position (don't reset)
        audioRef.current.play().catch(console.error)
        setIsPlaying(true)
      } else if (!controlledIsPlaying && !audioRef.current.paused) {
        // Pause at current position (don't reset currentTime)
        audioRef.current.pause()
        setIsPlaying(false)
      }
    }
  }, [controlledIsPlaying])

  const handlePlayPause = React.useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    
    if (!audioRef.current) return

    // Stop other audio/video if callback provided
    onStopOthers?.(attachmentId)

    if (playing) {
      audioRef.current.pause()
      if (controlledIsPlaying === undefined) {
        setIsPlaying(false)
      }
      onPlayStateChange?.(attachmentId, false)
    } else {
      audioRef.current.play().catch(console.error)
      if (controlledIsPlaying === undefined) {
        setIsPlaying(true)
      }
      onPlayStateChange?.(attachmentId, true)
    }
  }, [playing, controlledIsPlaying, onPlayStateChange, onStopOthers, attachmentId])

  const handleSeek = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const audio = audioRef.current
    if (!audio || !audioProgress.duration) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    const newTime = percentage * audioProgress.duration

    audio.currentTime = Math.max(0, Math.min(newTime, audio.duration))
    setAudioProgress(prev => ({
      current: audio.currentTime,
      duration: prev.duration || 0
    }))
  }, [audioProgress.duration])

  return (
    <div className={cn("w-full", className)}>
      <div className="p-3 sm:p-4 space-y-2 pb-8 sm:pb-9">
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={handlePlayPause}
            className="flex-shrink-0 relative h-10 w-10 cursor-pointer"
          >
            <div className="relative h-10 w-10">
              <div
                className={cn(
                  "transition-transform h-10 w-10",
                  playing && "animate-spin"
                )}
                style={{
                  animationDuration: playing ? '2s' : 'none',
                  transformOrigin: 'center center'
                }}
              >
                <Avatar 
                  className="h-10 w-10 border-2 border-white/20" 
                  userId={senderId}
                  showHoverCard={false}
                >
                  <AvatarImage src={senderAvatar ?? undefined} alt={senderName} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm uppercase">
                    {senderInitials}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                {playing ? (
                  <Pause className="h-5 w-5 text-white/90 drop-shadow-lg fill-white/90" />
                ) : (
                  <Play className="h-5 w-5 text-white/90 drop-shadow-lg fill-white/90" />
                )}
              </div>
            </div>
          </button>
          <div className="font-mono text-sm text-white/80 whitespace-nowrap flex-shrink-0 ml-6 sm:ml-8">
            {audioProgress.duration
              ? `${formatAudioTime(audioProgress.current || 0)} / ${formatAudioTime(audioProgress.duration)}`
              : `0:00 / —`
            }
          </div>
        </div>
        <div
          className="w-full h-2 bg-white/10 rounded-full mt-2 cursor-pointer relative group backdrop-blur-sm overflow-visible"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-gradient-to-r from-white via-white to-white transition-all duration-100 rounded-full shadow-[0_0_4px_rgba(255,255,255,0.5),0_0_8px_rgba(255,255,255,0.3)] relative"
            style={{
              width: audioProgress.duration
                ? `${(audioProgress.current / audioProgress.duration) * 100}%`
                : '0%'
            }}
          >
            <div
              className={cn(
                "absolute right-0 top-1/2 w-8 h-8 bg-white/90 blur-lg rounded-full pointer-events-none transition-opacity",
                playing ? "animate-edge-glow opacity-100" : "opacity-0"
              )}
              style={{
                transform: 'translate(50%, -50%)'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

