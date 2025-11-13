"use client"

import * as React from "react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { BonusCountdown } from "@/components/bonus-countdown"
import { Gift, ArrowRight, Sparkles } from "lucide-react"
import confetti from "canvas-confetti"

interface TopUpBonusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bonusPoints: number
  bonusEndTime?: string | null
}

export function TopUpBonusDialog({ open, onOpenChange, bonusPoints, bonusEndTime }: TopUpBonusDialogProps) {
  const expirationTime = bonusEndTime ? new Date(bonusEndTime) : null
  const isTodayOnly = expirationTime && expirationTime.toDateString() === new Date().toDateString()
  const dialogRef = React.useRef<HTMLDivElement>(null)

  // Fire confetti when dialog opens
  React.useEffect(() => {
    if (open) {
      // Set z-index on confetti canvas to appear above dialog
      const setConfettiZIndex = () => {
        // Find all canvas elements (confetti creates a canvas)
        const canvases = document.querySelectorAll('canvas')
        canvases.forEach((canvas) => {
          const style = window.getComputedStyle(canvas)
          // Check if it's a fixed position canvas (confetti canvas)
          if (style.position === 'fixed') {
            ;(canvas as HTMLCanvasElement).style.zIndex = '400002' // Above dialog (400001) and overlay (400000)
          }
        })
      }

      // Single confetti blast
      const timer = setTimeout(() => {
        confetti({
          particleCount: 200,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#FFD700', '#FFA500', '#FFFF00', '#FFE55C', '#9333EA', '#A855F7', '#C084FC', '#D8B4FE'],
          ticks: 200,
          gravity: 1.2,
          decay: 0.94,
          startVelocity: 35,
          scalar: 1.3,
        })
        setConfettiZIndex()
      }, 100)

      // Also set z-index immediately and on a short interval to catch the canvas
      setConfettiZIndex()
      const intervalId = setInterval(setConfettiZIndex, 50)

      return () => {
        clearTimeout(timer)
        clearInterval(intervalId)
      }
    }
  }, [open])
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        ref={dialogRef}
        className="sm:max-w-md [&>div]:p-0 [&>div]:relative [&>div]:overflow-y-auto [&>div]:flex [&>div]:flex-col [&>div]:h-full [&>button]:z-[50]"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        style={{
          border: '2px solid rgba(255, 215, 0, 0.4)',
          background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.2) 0%, rgba(255, 215, 0, 0.2) 50%, rgba(147, 51, 234, 0.2) 100%)',
          boxShadow: '0 0 40px rgba(147, 51, 234, 0.4), 0 0 80px rgba(255, 215, 0, 0.3), inset 0 0 60px rgba(147, 51, 234, 0.1)',
        }}
      >
        <div className="relative flex-1 min-h-0 overflow-hidden">
          {/* Animated gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 via-purple-500/10 to-yellow-400/10 animate-pulse pointer-events-none z-0" />
          
          {/* Sparkle effects */}
          <div className="absolute top-4 right-20 sm:top-2 sm:right-1/2 sm:translate-x-1/2 pointer-events-none z-[1]">
            <Sparkles className="h-6 w-6 text-yellow-400 animate-pulse" />
          </div>
          <div className="absolute top-8 left-6 pointer-events-none z-[1]">
            <Sparkles className="h-4 w-4 text-purple-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
          </div>
          <div className="absolute bottom-20 right-8 pointer-events-none z-[1]">
            <Sparkles className="h-5 w-5 text-yellow-300 animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          <div className="p-4 sm:p-5 relative z-[2] overflow-y-auto h-full flex flex-col justify-center sm:justify-start">
            <DialogHeader className="space-y-2">
              <div className="flex justify-center">
                <div 
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-purple-500 flex items-center justify-center border-2 border-yellow-400/50 shadow-lg relative overflow-hidden"
                  style={{
                    boxShadow: '0 0 20px rgba(255, 215, 0, 0.6), 0 0 40px rgba(147, 51, 234, 0.4)',
                  }}
                >
                  {/* Rotating shimmer effect */}
                  <div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    style={{
                      animation: 'shimmer-rotate 2s infinite',
                    }}
                  />
                  <Gift className="h-8 w-8 sm:h-10 sm:w-10 text-white relative z-10 drop-shadow-lg" />
                </div>
              </div>
              <DialogTitle className="text-xl sm:text-2xl text-center font-bold bg-gradient-to-r from-yellow-400 via-yellow-300 to-purple-400 bg-clip-text text-transparent">
                Get Your Bonus Points!
              </DialogTitle>
              <DialogDescription className="text-center text-white/80 text-xs sm:text-sm font-medium">
                Awarded automatically when you complete your top-up
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 pt-1">
              {/* Bonus Points Highlight */}
              <div className="text-center">
                <div className="inline-flex items-baseline gap-1.5 relative">
                  <span 
                    className="text-4xl sm:text-5xl font-black bg-gradient-to-br from-yellow-400 via-yellow-300 to-purple-400 bg-clip-text text-transparent drop-shadow-lg"
                    style={{
                      textShadow: '0 0 15px rgba(255, 215, 0, 0.5), 0 0 30px rgba(147, 51, 234, 0.3)',
                      filter: 'drop-shadow(0 0 6px rgba(255, 215, 0, 0.6))',
                    }}
                  >
                    +{bonusPoints.toLocaleString()}
                  </span>
                  <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-yellow-300 to-purple-300 bg-clip-text text-transparent">points</span>
                </div>
                {isTodayOnly && (
                  <div className="mt-2">
                    <span 
                      className="inline-flex items-center text-[10px] sm:text-xs font-bold text-white bg-gradient-to-r from-yellow-500/90 to-purple-500/90 px-3 py-1 rounded-full border-2 border-yellow-400/50 shadow-lg"
                      style={{
                        boxShadow: '0 0 12px rgba(255, 215, 0, 0.5)',
                      }}
                    >
                      Today Only
                    </span>
                  </div>
                )}
              </div>

              {/* Countdown */}
              {expirationTime && (
                <BonusCountdown endTime={bonusEndTime!} />
              )}

              {/* Info Text */}
              {expirationTime && (
                <div className="text-center">
                  <p className="text-[10px] sm:text-xs text-white/60 font-medium">
                    Expires: {expirationTime.toLocaleString(undefined, { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}

              {/* CTA Button */}
              <div className="pt-1">
                <Button 
                  asChild 
                  className="w-full h-10 sm:h-12 text-sm sm:text-base font-bold relative overflow-hidden group"
                  style={{
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #9333EA 100%)',
                    boxShadow: '0 0 15px rgba(255, 215, 0, 0.5), 0 0 30px rgba(147, 51, 234, 0.3)',
                  }}
                >
                  <Link href="/wallet?openTopup=true" onClick={() => onOpenChange(false)} className="relative z-10 flex items-center justify-center gap-2">
                    <span className="text-white drop-shadow-lg">Top Up Now</span>
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-white drop-shadow-lg animate-[arrow-bounce_1.5s_ease-in-out_infinite]" />
                    {/* Shimmer effect on button */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

