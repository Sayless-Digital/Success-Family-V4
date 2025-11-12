"use client"

import * as React from "react"

interface BonusCountdownProps {
  endTime: string
}

export function BonusCountdown({ endTime }: BonusCountdownProps) {
  const [hours, setHours] = React.useState<number>(0)
  const [minutes, setMinutes] = React.useState<number>(0)
  const [seconds, setSeconds] = React.useState<number>(0)
  const [isExpired, setIsExpired] = React.useState<boolean>(false)

  React.useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const end = new Date(endTime)
      const diff = end.getTime() - now.getTime()

      if (diff <= 0) {
        setIsExpired(true)
        setHours(0)
        setMinutes(0)
        setSeconds(0)
        return
      }

      setIsExpired(false)
      const h = Math.floor(diff / (1000 * 60 * 60))
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const s = Math.floor((diff % (1000 * 60)) / 1000)

      setHours(h)
      setMinutes(m)
      setSeconds(s)
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [endTime])

  if (isExpired) {
    return (
      <div className="text-center py-2">
        <div className="text-sm font-semibold text-white/60">Offer Expired</div>
      </div>
    )
  }

  // Show only relevant time units
  const showHours = hours > 0
  const showMinutes = minutes > 0 || hours > 0

  return (
    <div className="rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-white/20 p-3 sm:p-4">
      <div className="text-[10px] sm:text-xs font-semibold text-white/80 mb-2 sm:mb-3 text-center uppercase tracking-wider">
        Time Remaining
      </div>
      <div className="flex items-end justify-center gap-1 sm:gap-1.5">
        {showHours && (
          <>
            <div className="flex flex-col items-center">
              <div className="bg-white/15 backdrop-blur-sm border border-white/25 rounded-md px-2 py-1.5 sm:px-4 sm:py-3 min-w-[50px] sm:min-w-[70px] shadow-lg flex items-center justify-center">
                <div className="text-xl sm:text-3xl font-bold text-white tabular-nums leading-none text-center">
                  {String(hours).padStart(2, '0')}
                </div>
              </div>
              <div className="text-[8px] sm:text-[9px] text-white/50 mt-1 sm:mt-1.5 uppercase tracking-widest font-medium">Hours</div>
            </div>
            <div className="text-lg sm:text-2xl font-bold text-white/60 pb-2 sm:pb-3 leading-none">:</div>
          </>
        )}
        {showMinutes && (
          <>
            <div className="flex flex-col items-center">
              <div className="bg-white/15 backdrop-blur-sm border border-white/25 rounded-md px-2 py-1.5 sm:px-4 sm:py-3 min-w-[50px] sm:min-w-[70px] shadow-lg flex items-center justify-center">
                <div className="text-xl sm:text-3xl font-bold text-white tabular-nums leading-none text-center">
                  {String(minutes).padStart(2, '0')}
                </div>
              </div>
              <div className="text-[8px] sm:text-[9px] text-white/50 mt-1 sm:mt-1.5 uppercase tracking-widest font-medium">Minutes</div>
            </div>
            <div className="text-lg sm:text-2xl font-bold text-white/60 pb-2 sm:pb-3 leading-none">:</div>
          </>
        )}
        <div className="flex flex-col items-center">
          <div className="bg-white/15 backdrop-blur-sm border border-white/25 rounded-md px-2 py-1.5 sm:px-4 sm:py-3 min-w-[50px] sm:min-w-[70px] shadow-lg flex items-center justify-center">
            <div className="text-xl sm:text-3xl font-bold text-white tabular-nums leading-none text-center">
              {String(seconds).padStart(2, '0')}
            </div>
          </div>
          <div className="text-[8px] sm:text-[9px] text-white/50 mt-1 sm:mt-1.5 uppercase tracking-widest font-medium">Seconds</div>
        </div>
      </div>
    </div>
  )
}

