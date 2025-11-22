 "use client"

import Image from "next/image"
import { Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { ConversationListItem } from "@/lib/chat-shared"
import { getDisplayName, getInitials } from "../utils"

interface ConversationListProps {
  conversations: ConversationListItem[]
  searchTerm: string
  onSearchChange: (value: string) => void
  searchLoading: boolean
  selectedThreadId: string | null
  onSelectConversation: (threadId: string) => void
  onPrefetchMessages: (threadId: string) => void
  isMobile: boolean
  isClient: boolean
  mobileView?: "list" | "conversation"
  viewerId: string
  unreadCounts: Record<string, number>
  typingIndicators: Record<string, { userId: string; expiresAt: number }>
  presenceMap: Record<string, boolean>
  conversationImagePreviews: Record<string, { url: string; expiresAt: number }>
  liveMessagePreviews: Record<string, { content: string; senderId: string | null; timestamp: string | null; hasImage: boolean }>
}

export function ConversationList({
  conversations,
  searchTerm,
  onSearchChange,
  searchLoading,
  selectedThreadId,
  onSelectConversation,
  onPrefetchMessages,
  isMobile,
  isClient,
  mobileView = "list",
  viewerId,
  unreadCounts,
  typingIndicators,
  presenceMap,
  conversationImagePreviews,
  liveMessagePreviews,
}: ConversationListProps) {
  return (
    <div className={cn(
      "w-full lg:w-[360px] xl:w-[400px] lg:flex-none flex flex-col h-full",
      !isClient && "lg:flex hidden",
      isClient && isMobile && mobileView === "conversation" && "hidden",
      isClient && isMobile && mobileView === "list" && "flex lg:flex"
    )}>
      <div className="bg-white/10 border border-white/20 rounded-2xl backdrop-blur-md shadow-[0_20px_60px_-15px_rgba(0,0,0,0.45)] flex flex-col h-full">
        <div className="p-4 border-b border-white/15">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search conversations"
              className="bg-white/10 border-white/15 text-white pl-9 placeholder:text-white/40"
            />
            {searchLoading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/60" />
            )}
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2 min-w-0">
            {conversations.length === 0 && (
              <div className="px-3 py-8 text-center text-white/50 text-sm">
                No conversations found yet. Follow someone and start a chat!
              </div>
            )}
            {conversations.map((conversation) => {
              const otherProfile = conversation.other_user_profile
              const displayName = getDisplayName(otherProfile)
              const initials = getInitials(otherProfile)
              const avatarImage = otherProfile?.profile_picture ?? undefined
              const selected = !isMobile && conversation.thread_id === selectedThreadId
              const lastMessagePreview = liveMessagePreviews[conversation.thread_id]?.content || conversation.last_message_preview || (conversation.last_message_sender_id ? "[attachment]" : "No messages yet")
              const unread =
                conversation.last_message_sender_id &&
                conversation.last_message_sender_id !== viewerId &&
                conversation.last_message_at &&
                (!conversation.last_read_at ||
                  new Date(conversation.last_message_at).getTime() > new Date(conversation.last_read_at).getTime())

              const typingForConversation =
                typingIndicators[conversation.thread_id] && typingIndicators[conversation.thread_id]?.userId === conversation.other_user_id

              return (
                <button
                  key={conversation.thread_id}
                  type="button"
                  onClick={() => onSelectConversation(conversation.thread_id)}
                  onMouseEnter={() => {
                    if (!isMobile) {
                      onPrefetchMessages(conversation.thread_id)
                    }
                  }}
                  className={cn(
                    "w-full max-w-full box-border rounded-xl border transition-all text-left backdrop-blur-md cursor-pointer overflow-hidden",
                    "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20",
                    selected && "bg-white/10 border-white/20 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]",
                  )}
                >
                  <div className="px-3 py-3 flex items-start gap-3 w-full overflow-hidden">
                    <div onClick={(e) => e.stopPropagation()}>
                      <Avatar 
                        className="h-11 w-11 border-4 border-white/20 flex-shrink-0" 
                        userId={otherProfile?.id} 
                        isOnline={presenceMap[conversation.thread_id] || false}
                        showHoverCard={true}
                        username={otherProfile?.username || undefined}
                        firstName={otherProfile?.first_name || undefined}
                        lastName={otherProfile?.last_name || undefined}
                        profilePicture={otherProfile?.profile_picture || undefined}
                        bio={otherProfile?.bio || undefined}
                      >
                        <AvatarImage src={avatarImage} alt={displayName} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground uppercase">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0 w-0 overflow-hidden">
                      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                        <p className="text-white/80 font-medium truncate flex-shrink">{displayName}</p>
                        {typingForConversation && (
                          <Badge className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-100 flex-shrink-0">Typing</Badge>
                        )}
                      </div>
                      {typingForConversation ? (
                        <p className={cn("text-xs truncate", unread ? "text-white" : "text-white/50")}>
                          Typing…
                        </p>
                      ) : conversationImagePreviews[conversation.thread_id]?.url ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded border border-white/20 overflow-hidden flex-shrink-0 bg-white/5">
                            <Image
                              src={conversationImagePreviews[conversation.thread_id].url}
                              alt="Image preview"
                              width={16}
                              height={16}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          {lastMessagePreview && lastMessagePreview !== "[image]" && lastMessagePreview !== "[attachment]" && (
                            <p className={cn("text-xs truncate", unread ? "text-white" : "text-white/50")}>
                              {lastMessagePreview}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p
                          className={cn("text-xs truncate", unread ? "text-white" : "text-white/50")}
                        >
                          {lastMessagePreview}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="text-[11px] text-white/50 whitespace-nowrap" suppressHydrationWarning>
                        {conversation.last_message_at
                          ? formatRelativeTime(conversation.last_message_at)
                          : formatRelativeTime(conversation.updated_at)}
                      </span>
                      {(() => {
                        const unreadCount = unreadCounts[conversation.thread_id] || 0
                        if (unreadCount > 0) {
                          return (
                            <Badge className="h-5 min-w-5 px-1.5 flex items-center justify-center bg-white/90 text-black border-0 text-[10px] font-semibold shadow-md">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </Badge>
                          )
                        }
                        return null
                      })()}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
