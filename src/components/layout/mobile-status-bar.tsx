"use client"

import { useState, useEffect } from "react"

interface MobileStatusBarProps {
  isFullscreen: boolean
  isMobile: boolean
}

export function MobileStatusBar({ isFullscreen, isMobile }: MobileStatusBarProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)

  // Update time every minute
  useEffect(() => {
    if (!isFullscreen || !isMobile) return

    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    // Set initial time
    setCurrentTime(new Date())

    return () => clearInterval(timer)
  }, [isFullscreen, isMobile])

  // Get battery level
  useEffect(() => {
    if (!isFullscreen || !isMobile || typeof navigator === "undefined") return

    // Check if Battery API is available
    if ('getBattery' in navigator) {
      ;(navigator as any).getBattery().then((battery: any) => {
        const updateBattery = () => {
          setBatteryLevel(Math.round(battery.level * 100))
        }

        updateBattery()
        battery.addEventListener('levelchange', updateBattery)
        battery.addEventListener('chargingchange', updateBattery)

        return () => {
          battery.removeEventListener('levelchange', updateBattery)
          battery.removeEventListener('chargingchange', updateBattery)
        }
      }).catch(() => {
        // Battery API not available or denied
        setBatteryLevel(null)
      })
    } else {
      setBatteryLevel(null)
    }
  }, [isFullscreen, isMobile])

  // Format time as 12-hour format (HH:MM AM/PM)
  const formattedTime = currentTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  if (!isFullscreen || !isMobile) {
    return null
  }

  return (
    <div
      className="fixed left-0 right-0 z-[160000] flex items-center justify-between px-4 pointer-events-none"
      style={{
        top: "env(safe-area-inset-top, 0)",
        marginTop: "-1.5rem",
        height: "1.25rem",
        minHeight: "1.25rem",
      }}
    >
      {/* Left side - Time */}
      <div className="flex items-center">
        <span className="text-xs font-semibold text-white/90">
          {formattedTime}
        </span>
      </div>

      {/* Right side - Battery with icon and percentage */}
      <div className="flex items-center">
        {batteryLevel !== null && (
          <div className="flex items-center">
            {/* Battery icon with progress bar and percentage inside */}
            <div className="relative w-7 h-3.5 border border-white/90 rounded-md overflow-hidden">
              {/* Battery fill - progress bar */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-white/40 transition-all duration-300 rounded-md"
                style={{
                  width: `${batteryLevel}%`,
                }}
              />
              {/* Battery percentage - centered on both axes */}
              <span className="absolute left-0 right-0 top-0 bottom-0 flex items-center justify-center text-[7px] font-semibold text-white/90 leading-none">
                {batteryLevel}%
              </span>
              {/* Battery connector/tip */}
              <div className="absolute -right-[3px] top-[2px] w-[3px] h-[10px] bg-white/90 rounded-r-sm" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

