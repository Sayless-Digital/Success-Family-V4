"use client"

import * as React from "react"

interface BonusCountdownProps {
  endTime: string
}

export function BonusCountdown({ endTime }: BonusCountdownProps) {
  const [timeRemaining, setTimeRemaining] = React.useState<string>("")

  React.useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const end = new Date(endTime)
      const diff = end.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeRemaining("Expired")
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`)
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`)
      } else {
        setTimeRemaining(`${seconds}s`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [endTime])

  if (!timeRemaining) return null

  return (
    <div className="text-xs text-white/60">
      Time remaining: <span className="font-medium text-white/80">{timeRemaining}</span>
    </div>
  )
}

