"use client"

import { useEffect, useState } from "react"
import { Clock, Users } from "lucide-react"
import { useCallStateHooks } from "@stream-io/video-react-sdk"
import type { CommunityEvent } from "@/types"

interface StreamInfoProps {
  event: CommunityEvent
  community: any
}

/**
 * Stream info display component
 * Shows duration, participant count, and live indicator
 */
export function StreamInfo({ event, community }: StreamInfoProps) {
  const [duration, setDuration] = useState("00:00")
  const [showInfo, setShowInfo] = useState(false)
  const { useParticipantCount } = useCallStateHooks()
  const participantCount = useParticipantCount()

  useEffect(() => {
    const startTime = new Date(event.started_at || Date.now())
    const interval = setInterval(() => {
      const now = new Date()
      const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000)
      const hours = Math.floor(diff / 3600)
      const minutes = Math.floor((diff % 3600) / 60)
      const seconds = diff % 60
      if (hours > 0) {
        setDuration(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      } else {
        setDuration(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [event.started_at])

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
        <Clock className="h-3.5 w-3.5 text-white/70" />
        <span className="text-sm text-white font-mono tabular-nums">{duration}</span>
      </div>
      
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
        <Users className="h-3.5 w-3.5 text-white/70" />
        <span className="text-sm text-white font-medium">{participantCount}</span>
      </div>
      
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 backdrop-blur-sm border border-green-500/30">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm text-green-400 font-medium">Live</span>
      </div>
    </div>
  )
}