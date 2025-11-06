"use client"

import React from "react"
import { MicOff } from "lucide-react"
import { ParticipantView, type Call, hasScreenShare } from "@stream-io/video-react-sdk"
import { Badge } from "@/components/ui/badge"

interface ParticipantVideoProps {
  participant: any
  isHost?: boolean
  call?: Call
  trackType?: "videoTrack" | "screenShareTrack"
}

/**
 * Custom Participant Video Component
 * Uses GetStream's ParticipantView for reliable video, but with custom styling overlays
 */
export function ParticipantVideo({
  participant,
  isHost = false,
  call,
  trackType = "videoTrack"
}: ParticipantVideoProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Check if video/audio tracks are published
  // Stream.io SDK uses numeric track IDs (like [3]) not string names
  const publishedTracks = participant.publishedTracks as Set<string | number> | (string | number)[] | undefined
  const tracksArray = publishedTracks instanceof Set ? Array.from(publishedTracks) : (Array.isArray(publishedTracks) ? publishedTracks : [])
  
  // Convert all tracks to strings for comparison (handles numeric IDs)
  const tracksAsStrings = tracksArray.map(t => String(t).toLowerCase())
  
  // Check for video track - Stream.io SDK may use numeric IDs, so check if tracks exist
  // Also check if videoStream/videoTrack exists directly (more reliable)
  const hasVideoStreamDirect = !!(participant.videoStream || (participant as any).videoTrack)
  const hasVideoTrackId = !!(participant as any).videoTrackId
  
  // If there are any tracks, assume video is available (Stream.io uses numeric IDs)
  // Numeric track IDs (like [3]) mean a track exists, just not with a string name
  // Also check for explicit video track names or videoStream directly
  const hasPublishedVideo = tracksArray.length > 0  // If any tracks exist (even numeric), assume video
    ? true  // Numeric track IDs mean a track was published
    : (tracksAsStrings.includes('videotrack') || 
       tracksAsStrings.includes('video') || 
       tracksAsStrings.some(t => t.includes('video')) ||
       hasVideoStreamDirect ||
       hasVideoTrackId)
  
  // Check for screen share using SDK's hasScreenShare utility (most reliable)
  // This works for both local and remote participants
  const hasScreenShareFromSDK = React.useMemo(() => {
    if (typeof hasScreenShare === 'function') {
      try {
        return hasScreenShare(participant)
      } catch (e) {
        return false
      }
    }
    return false
  }, [participant])
  
  // If tracks exist (even as numbers) and no explicit track type, check participant properties
  // The presence of tracks (numeric IDs) means something was published
  const hasAnyTracks = tracksArray.length > 0
  
  const hasAudioTrack = publishedTracks
    ? (publishedTracks instanceof Set ? publishedTracks.has('audioTrack') : publishedTracks.includes('audioTrack'))
    : !!participant.audioStream || !!(participant as any).audioTrack

  // Determine the actual track type to use
  // CRITICAL: If screenShareTrack is requested AND SDK confirms screen share exists, use it
  // If screenShareTrack is requested but SDK doesn't confirm, still try it (ParticipantView handles missing tracks gracefully)
  // Otherwise use videoTrack
  const actualTrackType: "videoTrack" | "screenShareTrack" = React.useMemo(() => {
    if (trackType === "screenShareTrack") {
      // Always use screenShareTrack when requested - ParticipantView will handle missing tracks gracefully
      return "screenShareTrack"
    }
    return "videoTrack"
  }, [trackType])
  
  // If we have a videoStream but no published tracks, still try to show video
  // This handles cases where the stream exists but isn't in publishedTracks yet
  // Also handle numeric track IDs - if tracks exist (even as numbers), try to show video
  // If tracks exist (numeric IDs like [3]), assume video is available
  // For screen share, use SDK's detection
  const shouldShowVideo = hasPublishedVideo || hasVideoStreamDirect || hasScreenShareFromSDK || hasAnyTracks || trackType === "screenShareTrack"

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-black rounded-lg overflow-hidden border-2 border-white/10 backdrop-blur-sm"
    >
      {/* Use GetStream's ParticipantView for reliable video rendering */}
      {/* CSS customizations are in globals.css to make avatars round */}
      {/* Always render ParticipantView - it handles empty states gracefully */}
      <div className="absolute inset-0 w-full h-full stream-participant-wrapper" style={{ zIndex: 1 }}>
        <ParticipantView
          participant={participant}
          className="w-full h-full"
          trackType={actualTrackType}
        />
      </div>
      
      {/* Custom overlays on top */}
      {/* Host badge - top of container */}
      {isHost && (
        <div className="absolute top-0.5 left-1.5 z-10">
          <Badge className="bg-white/20 text-white text-[10px] px-1.5 py-0 h-4 border-0">
            Host
          </Badge>
        </div>
      )}
      
      {/* Name overlay */}
      <div className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md max-w-[calc(100%-12px)] z-10">
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