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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface BoostRewardsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requiresBoost?: boolean
  onRequiresBoostChange?: (requiresBoost: boolean) => void
  boostRewardMessage?: string | null
  onBoostRewardMessageChange?: (message: string) => void
  mediaType?: "audio" | "image" | "video" | "document"
}

export function BoostRewardsDialog({
  open,
  onOpenChange,
  requiresBoost,
  onRequiresBoostChange,
  boostRewardMessage,
  onBoostRewardMessageChange,
  mediaType = "audio",
}: BoostRewardsDialogProps) {
  const [messageEnabled, setMessageEnabled] = React.useState((boostRewardMessage?.length || 0) > 0)

  React.useEffect(() => {
    setMessageEnabled((boostRewardMessage?.length || 0) > 0)
  }, [boostRewardMessage])

  const handleCheckedChange = (checked: boolean) => {
    onRequiresBoostChange?.(checked)
  }

  const handleMessageEnabledChange = (checked: boolean) => {
    setMessageEnabled(checked)
    if (!checked) {
      onBoostRewardMessageChange?.("")
    }
  }

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onBoostRewardMessageChange?.(e.target.value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Crown className="h-5 w-5 text-white/80" />
            <DialogTitle>Boost Rewards</DialogTitle>
          </div>
          <DialogDescription className="text-white/70 text-center">
            Reward users who boost your post with exclusive content or automated messages.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 mt-6">
          {mediaType === "audio" && onRequiresBoostChange !== undefined && (
            <div className="flex items-start space-x-3 p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
              <Checkbox
                id="lock-voice-note"
                checked={requiresBoost || false}
                onCheckedChange={handleCheckedChange}
                className="mt-1"
              />
              <div className="flex-1">
                <Label
                  htmlFor="lock-voice-note"
                  className="text-sm font-medium text-white/90 cursor-pointer leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Lock voice note behind boost
                </Label>
              </div>
            </div>
          )}
          
          {/* Automated Message Reward */}
          {onBoostRewardMessageChange !== undefined && (
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                <Checkbox
                  id="enable-boost-message"
                  checked={messageEnabled}
                  onCheckedChange={handleMessageEnabledChange}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label
                    htmlFor="enable-boost-message"
                    className="text-sm font-medium text-white/90 cursor-pointer leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Send automated message to boosters
                  </Label>
                  <p className="text-xs text-white/60 mt-1">
                    Costs 1 point to add
                  </p>
                </div>
              </div>
              {messageEnabled && (
                <div className="space-y-2">
                  <Textarea
                    id="boost-reward-message"
                    placeholder="e.g., Thanks for boosting! Here are some helpful resources: https://example.com"
                    value={boostRewardMessage || ""}
                    onChange={handleMessageChange}
                    className="w-full min-h-[100px] bg-white/10 border-white/20 text-white placeholder:text-white/40 resize-none focus:ring-2 focus:ring-white/30"
                    maxLength={2000}
                  />
                  <p className="text-xs text-white/50">
                    {(boostRewardMessage?.length || 0)} / 2000 characters
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

