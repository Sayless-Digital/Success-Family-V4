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
import { Gift, ArrowRight } from "lucide-react"

interface TopUpBonusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bonusPoints: number
  bonusEndTime?: string | null
}

export function TopUpBonusDialog({ open, onOpenChange, bonusPoints, bonusEndTime }: TopUpBonusDialogProps) {
  const expirationTime = bonusEndTime ? new Date(bonusEndTime) : null
  const isTodayOnly = expirationTime && expirationTime.toDateString() === new Date().toDateString()
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-white/20 to-white/10 flex items-center justify-center border-4 border-white/20">
              <Gift className="h-8 w-8 text-white/80" />
            </div>
          </div>
          <DialogTitle className="text-2xl text-center">Get Your Bonus Points!</DialogTitle>
          <DialogDescription className="text-center text-white/80">
            Top up now to receive <span className="font-semibold text-white">{bonusPoints.toLocaleString()} bonus points</span> on your top-up!
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="rounded-lg bg-white/10 border border-white/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/60">Bonus Offer</div>
              {isTodayOnly && (
                <span className="text-xs font-medium text-white/80 bg-white/10 px-2 py-0.5 rounded">Today Only</span>
              )}
            </div>
            <div className="text-2xl font-bold text-white">
              +{bonusPoints.toLocaleString()} <span className="text-lg font-medium text-white/80">points</span>
            </div>
            <div className="text-xs text-white/60">
              Awarded automatically on your top-up
            </div>
            {expirationTime && (
              <div className="text-xs text-white/60 pt-1 border-t border-white/20">
                Expires: {expirationTime.toLocaleString(undefined, { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full bg-white/10 text-white/80 hover:bg-white/20">
              <Link href="/wallet" onClick={() => onOpenChange(false)}>
                Top Up Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="w-full text-white/60 hover:text-white/80 hover:bg-white/10"
            >
              Maybe Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

