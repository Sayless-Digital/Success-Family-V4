"use client"

import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatRelativeTime } from "@/lib/utils"
import type { ConversationListItem } from "@/lib/chat-shared"
import { getDisplayName, getInitials } from "../utils"

interface ConversationHeaderProps {
  conversation: ConversationListItem | null
  isMobile: boolean
  onBack: () => void
  isPeerOnline: boolean
}

export function ConversationHeader({ conversation, isMobile, onBack, isPeerOnline }: ConversationHeaderProps) {
  if (!conversation) return null

  const peerProfile = conversation.other_user_profile
  const peerName = getDisplayName(peerProfile)
  const peerInitials = getInitials(peerProfile)
  const peerAvatar = peerProfile?.profile_picture ?? null

  return (
    <div className="p-4 border-b border-white/15 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-full text-white/70 hover:text-white/90 hover:bg-white/10 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div onClick={(e) => e.stopPropagation()}>
          <Avatar 
            className="h-11 w-11 border-4 border-white/20" 
            userId={peerProfile?.id} 
            isOnline={isPeerOnline}
            showHoverCard={true}
            username={peerProfile?.username || undefined}
            firstName={peerProfile?.first_name || undefined}
            lastName={peerProfile?.last_name || undefined}
            profilePicture={peerProfile?.profile_picture || undefined}
            bio={peerProfile?.bio || undefined}
          >
            <AvatarImage src={peerAvatar || undefined} alt={peerName} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground uppercase">
              {peerInitials}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-white/90 font-semibold text-sm sm:text-base truncate">{peerName}</h2>
          </div>
          <p className="text-xs text-white/50" suppressHydrationWarning>
            {isPeerOnline ? "Online now" : `Last active ${formatRelativeTime(conversation.other_last_seen_at ?? conversation.updated_at)}`}
          </p>
        </div>
      </div>
    </div>
  )
}
