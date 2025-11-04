"use client"

import React from "react"
import { MicOff } from "lucide-react"
import { ParticipantView, type Call } from "@stream-io/video-react-sdk"
import { Badge } from "@/components/ui/badge"

interface ParticipantVideoProps {
  participant: any
  isHost?: boolean
  call?: Call
}

/**
 * Custom Participant Video Component
 * Uses GetStream's ParticipantView for reliable video, but with custom styling overlays
 */
export function ParticipantVideo({
  participant,
  isHost = false,
  call
}: ParticipantVideoProps) {
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