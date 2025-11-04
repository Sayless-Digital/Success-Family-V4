"use client"

import { useState } from "react"
import { Users, MessageSquare, X, Search, MicOff, VideoOff } from "lucide-react"
import { useCallStateHooks } from "@stream-io/video-react-sdk"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { getInitials } from "./utils"

interface StreamSidebarProps {
  show: boolean
  onClose: () => void
  activeTab: "participants" | "chat"
}

/**
 * Sidebar component for participants and chat - Platform style
 * Shows list of participants with search, or chat interface (coming soon)
 */
export function StreamSidebar({
  show,
  onClose,
  activeTab,
}: StreamSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const { useParticipantCount, useParticipants } = useCallStateHooks()
  const participantCount = useParticipantCount()
  const participants = useParticipants()

  // Filter participants based on search
  const filteredParticipants = participants.filter((participant) =>
    participant.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div
      className={cn(
        "absolute right-0 top-0 bottom-12 w-80 md:w-96 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-l border-white/20 z-50 flex flex-col transition-transform duration-300 ease-out shadow-2xl",
        show ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/20">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-white/70" />
          <h3 className="text-white font-semibold text-base">
            {activeTab === "participants" ? `In call (${participantCount})` : "Messages"}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-white/70 hover:text-white hover:bg-white/10 rounded-full h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search Bar - Only show for participants */}
      {activeTab === "participants" && (
        <div className="px-4 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <Input
              type="text"
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:bg-white/10 focus:border-white/30"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {activeTab === "participants" ? (
          <div className="p-4 space-y-2">
            {filteredParticipants.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/60 text-sm">No participants found</p>
              </div>
            ) : (
              filteredParticipants.map((participant) => (
              <div
                key={participant.sessionId}
                className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all duration-200"
              >
                <Avatar className="h-10 w-10 border-2 border-white/20">
                  <AvatarImage src={participant.image} alt={participant.name} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white text-sm">
                    {getInitials(participant.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    {participant.name || 'Unknown User'}
                  </p>
                  {participant.isLocalParticipant && (
                    <p className="text-white/60 text-xs">You</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!participant.audioStream && (
                    <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center">
                      <MicOff className="h-3 w-3 text-white/70" />
                    </div>
                  )}
                  {!(participant.videoStream || ((participant.publishedTracks as any) && Array.isArray(participant.publishedTracks) && ((participant.publishedTracks as any).includes('videoTrack') || (participant.publishedTracks as any).includes('video'))) || (participant as any).videoTrack) && (
                    <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center">
                      <VideoOff className="h-3 w-3 text-white/70" />
                    </div>
                  )}
                </div>
              </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-white/50" />
            </div>
            <h4 className="text-white font-medium mb-2">Messages coming soon</h4>
            <p className="text-white/60 text-sm">
              Chat with participants during the call
            </p>
          </div>
        )}
      </div>
    </div>
  )
}