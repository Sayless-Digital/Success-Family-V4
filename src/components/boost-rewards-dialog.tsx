"use client"

import * as React from "react"
import { Crown } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface BoostRewardsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requiresBoost: boolean
  onRequiresBoostChange: (requiresBoost: boolean) => void
  mediaType?: "audio" | "image" | "video" | "document"
}

export function BoostRewardsDialog({
  open,
  onOpenChange,
  requiresBoost,
  onRequiresBoostChange,
  mediaType = "audio",
}: BoostRewardsDialogProps) {
  const handleCheckedChange = (checked: boolean) => {
    onRequiresBoostChange(checked)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-5 w-5 text-white/80" />
            <DialogTitle>Boost Rewards</DialogTitle>
          </div>
          <DialogDescription className="text-white/70">
            Lock content behind boosts to reward users who support your post.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {mediaType === "audio" && (
            <div className="flex items-start space-x-3 p-3 rounded-lg bg-white/5 border border-white/10">
              <Checkbox
                id="lock-voice-note"
                checked={requiresBoost}
                onCheckedChange={handleCheckedChange}
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="lock-voice-note"
                  className="text-sm font-medium text-white/90 cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Lock voice note behind boost
                </Label>
                <p className="text-xs text-white/60">
                  Users must boost your post to access this voice note.
                </p>
              </div>
            </div>
          )}
          
          {/* Future reward types can be added here */}
        </div>
      </DialogContent>
    </Dialog>
  )
}

