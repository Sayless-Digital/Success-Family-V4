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
  const handleCheckedChange = (checked: boolean) => {
    onRequiresBoostChange?.(checked)
  }

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onBoostRewardMessageChange?.(e.target.value)
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
            Reward users who boost your post with exclusive content or automated messages.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {mediaType === "audio" && onRequiresBoostChange !== undefined && (
            <div className="flex items-start space-x-3 p-3 rounded-lg bg-white/5 border border-white/10">
              <Checkbox
                id="lock-voice-note"
                checked={requiresBoost || false}
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
          
          {/* Automated Message Reward */}
          {onBoostRewardMessageChange !== undefined && (
            <div className="space-y-2 p-3 rounded-lg bg-white/5 border border-white/10">
              <Label htmlFor="boost-reward-message" className="text-sm font-medium text-white/90">
                Automated boost message
              </Label>
              <p className="text-xs text-white/60">
                Send an automated DM to users who boost your post. Perfect for sharing links, resources, or thank you messages.
              </p>
              <Textarea
                id="boost-reward-message"
                placeholder="e.g., Thanks for boosting! Here are some helpful resources: https://example.com"
                value={boostRewardMessage || ""}
                onChange={handleMessageChange}
                className="min-h-[100px] bg-white/10 border-white/20 text-white placeholder:text-white/40 resize-none"
                maxLength={2000}
              />
              <p className="text-xs text-white/50">
                {(boostRewardMessage?.length || 0)} / 2000 characters
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

