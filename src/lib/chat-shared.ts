import type {
  DirectMessage,
  DirectMessageAttachment,
  DirectMessageConversationSummary,
  DirectMessageParticipant,
} from "@/types"

export const DM_THREAD_CHANNEL_PREFIX = "dm:thread"
export const DM_TYPING_EVENT = "typing"
export const DM_PRESENCE_CONTEXT = "presence"

export interface ConversationListItem extends DirectMessageConversationSummary {
  other_user_profile?: {
    id: string
    username: string
    first_name?: string | null
    last_name?: string | null
    profile_picture?: string | null
    bio?: string | null
  } | null
}

export interface MessageResult extends DirectMessage {
  attachments: DirectMessageAttachment[]
  replied_to_message?: {
    id: string
    sender_id: string
    content?: string | null
    has_attachments: boolean
    created_at: string
    attachments?: DirectMessageAttachment[]
  } | null
}

export function getThreadChannelName(threadId: string) {
  return `${DM_THREAD_CHANNEL_PREFIX}:${threadId}`
}

export function orderParticipants(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

export function getTypingChannel(threadId: string) {
  return `${getThreadChannelName(threadId)}:${DM_TYPING_EVENT}`
}

export function canUserInteractWithThread(
  participant: DirectMessageParticipant | null | undefined,
): boolean {
  if (!participant) return false
  // Allow messaging for all statuses except blocked (message requests are removed)
  return participant.status !== "blocked"
}

export function buildDmMediaStoragePath(userId: string, extension?: string) {
  const sanitizedExtension = extension ? extension.replace(/^\./, "") : "bin"
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 10)
  const objectPath = `${userId}/${timestamp}-${random}.${sanitizedExtension || "bin"}`
  const storagePath = `dm-media/${objectPath}`
  return {
    bucket: "dm-media" as const,
    objectPath,
    storagePath,
  }
}





