"use server"

import { randomUUID } from "crypto"
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

import { createServerSupabaseClient } from "@/lib/supabase-server"
import type {
  DMAttachmentType,
  Database,
  DirectMessage,
  DirectMessageAttachment,
  DirectMessageConversationSummary,
  DirectMessageParticipant,
  DirectMessageThread,
  DMMessageType,
  DMParticipantStatus,
} from "@/types"
import {
  ConversationListItem,
  MessageResult,
  orderParticipants,
} from "@/lib/chat-shared"

type TypedSupabaseClient = SupabaseClient<Database>
type ConversationSummaryRow = Database["public"]["Views"]["dm_conversation_summaries"]["Row"]
type ThreadRow = Database["public"]["Tables"]["dm_threads"]["Row"]
type ThreadInsert = Database["public"]["Tables"]["dm_threads"]["Insert"]
type ThreadUpdate = Database["public"]["Tables"]["dm_threads"]["Update"]
type ParticipantRow = Database["public"]["Tables"]["dm_participants"]["Row"]
type ParticipantUpdate = Database["public"]["Tables"]["dm_participants"]["Update"]
type UserRow = Database["public"]["Tables"]["users"]["Row"]

export interface ConversationListOptions {
  limit?: number
  search?: string
}

export interface EnsureThreadResult {
  thread: DirectMessageThread
  viewer: DirectMessageParticipant
  peer: DirectMessageParticipant
  isNew: boolean
}

// DEPRECATED: Message requests are no longer used
// Keeping interface for backwards compatibility
export interface AcceptMessageRequestResult {
  thread: DirectMessageThread
  participant: DirectMessageParticipant
  conversation: ConversationListItem | null
}

export interface MessageInput {
  threadId: string
  senderId: string
  content?: string | null
  messageType?: DMMessageType
  metadata?: Record<string, unknown> | null
  attachments?: Array<{
    storagePath: string
    mediaType: DMAttachmentType
    mimeType?: string
    fileSize?: number
    durationSeconds?: number
    fileName?: string
  }>
  replyToMessageId?: string | null
}

export async function getServerSupabaseClient() {
  return createServerSupabaseClient() as Promise<TypedSupabaseClient>
}

export async function getConversationSummaries(
  supabase: TypedSupabaseClient,
  viewerId: string,
  options: ConversationListOptions = {},
): Promise<ConversationListItem[]> {
  const limit = options.limit ?? 30
  const client = supabase as SupabaseClient<any>

  const { data, error } = await client
    .from("dm_conversation_summaries")
    .select("*")
    .eq("user_id", viewerId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    throw error
  }

  const summaries = (data ?? []) as DirectMessageConversationSummary[]

  const userIds = Array.from(new Set(summaries.map((item) => item.other_user_id)))

  let profileMap = new Map<string, ConversationListItem["other_user_profile"]>()

  if (userIds.length > 0) {
    const profileQuery = await client
      .from("users")
      .select("id, username, first_name, last_name, profile_picture, bio")
      .in("id", userIds)

    if (profileQuery.error) {
      throw profileQuery.error
    }

    profileMap = new Map(
      (profileQuery.data ?? []).map((profile: any) => [
        profile.id,
        {
          id: profile.id,
          username: profile.username,
          first_name: profile.first_name,
          last_name: profile.last_name,
          profile_picture: profile.profile_picture,
          bio: profile.bio,
        },
      ]),
    )
  }

  const enriched = summaries.map<ConversationListItem>((summary) => ({
    ...summary,
    other_user_profile: profileMap.get(summary.other_user_id) ?? null,
  }))

  if (!options.search?.trim()) {
    return enriched
  }

  const searchTerm = options.search.trim().toLowerCase()

  return enriched.filter((summary) => {
    const profile = summary.other_user_profile
    if (!profile) {
      return false
    }

    const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim().toLowerCase()
    return (
      profile.username.toLowerCase().includes(searchTerm) ||
      (fullName && fullName.includes(searchTerm))
    )
  })
}

export async function loadThreadParticipants(
  supabase: TypedSupabaseClient,
  threadId: string,
): Promise<DirectMessageParticipant[]> {
  const client = supabase as SupabaseClient<any>
  const { data, error } = await client
    .from("dm_participants")
    .select("*")
    .eq("thread_id", threadId)

  if (error) {
    throw error
  }

  return (data ?? []) as DirectMessageParticipant[]
}

export async function ensureThread(
  supabase: TypedSupabaseClient,
  viewerId: string,
  peerUserId: string,
): Promise<EnsureThreadResult> {
  if (!viewerId || !peerUserId || viewerId === peerUserId) {
    throw new Error("Invalid peer user")
  }

  const [userAId, userBId] = orderParticipants(viewerId, peerUserId)
  const client = supabase as SupabaseClient<any>

  // First, try to get existing thread
  const existing = await client
    .from("dm_threads")
    .select("*")
    .eq("user_a_id", userAId)
    .eq("user_b_id", userBId)
    .maybeSingle()

  if (existing.error) {
    throw existing.error
  }

  let thread: DirectMessageThread | null = (existing.data as DirectMessageThread) ?? null
  let isNew = false

  // Insert new thread if it doesn't exist (handle race conditions)
  if (!thread) {
    const inserted = await client
      .from("dm_threads")
      .insert({
        user_a_id: userAId,
        user_b_id: userBId,
        initiated_by: viewerId,
      })
      .select("*")
      .single()

    if (inserted.error) {
      // If insert failed due to unique constraint violation (race condition),
      // another request created the thread - fetch it
      if (inserted.error.code === "23505") {
        const retry = await client
          .from("dm_threads")
          .select("*")
          .eq("user_a_id", userAId)
          .eq("user_b_id", userBId)
          .single()

        if (retry.error) {
          throw retry.error
        }

        thread = retry.data as DirectMessageThread
        isNew = false
      } else {
        throw inserted.error
      }
    } else {
      thread = inserted.data as DirectMessageThread
      isNew = true
    }
  }

  if (!thread) {
    throw new Error("Failed to create or fetch thread")
  }

  // Wait a bit for database triggers to create participants if thread is new
  if (isNew) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Retry participant loading with exponential backoff for new threads
  let participants: DirectMessageParticipant[] = []
  const maxRetries = isNew ? 3 : 1
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    participants = await loadThreadParticipants(supabase, thread.id)
    
    const viewer = participants.find((p) => p.user_id === viewerId)
    const peer = participants.find((p) => p.user_id === peerUserId)
    
    if (viewer && peer) {
      return { thread, viewer, peer, isNew }
    }
    
    // Wait before retry (exponential backoff)
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)))
    }
  }

  // If we still don't have both participants after retries, fail
  const viewer = participants.find((p) => p.user_id === viewerId)
  const peer = participants.find((p) => p.user_id === peerUserId)

  if (!viewer) {
    throw new Error(`Viewer participant record missing for thread ${thread.id}. Database trigger may have failed.`)
  }

  if (!peer) {
    throw new Error(`Peer participant record missing for thread ${thread.id}. Database trigger may have failed.`)
  }

  return { thread, viewer, peer, isNew }
}

/**
 * Fetches replied message data with validation and attachments
 * Ensures the replied message exists in the same thread and is not deleted
 */
async function fetchRepliedMessage(
  supabase: TypedSupabaseClient,
  replyToMessageId: string | null,
  threadId: string,
): Promise<{
  id: string
  sender_id: string
  content?: string | null
  has_attachments: boolean
  created_at: string
  attachments?: DirectMessageAttachment[]
} | null> {
  if (!replyToMessageId) return null

  const client = supabase as SupabaseClient<any>
  
  // Fetch message and attachments in parallel
  const [messageResult, attachmentsResult] = await Promise.all([
    client
      .from("dm_messages")
      .select("id, sender_id, content, has_attachments, created_at, thread_id, is_deleted")
      .eq("id", replyToMessageId)
      .eq("thread_id", threadId) // Ensure same thread
      .eq("is_deleted", false) // Ensure not deleted
      .maybeSingle(),
    client
      .from("dm_message_media")
      .select("id, message_id, media_type, storage_path, mime_type, file_size, duration_seconds, file_name, created_at, source_storage_path, source_bucket")
      .eq("message_id", replyToMessageId),
  ])

  if (messageResult.error || !messageResult.data) {
    return null
  }

  return {
    id: messageResult.data.id,
    sender_id: messageResult.data.sender_id,
    content: messageResult.data.content ?? null,
    has_attachments: messageResult.data.has_attachments ?? false,
    created_at: messageResult.data.created_at,
    attachments: (attachmentsResult.data ?? []) as DirectMessageAttachment[],
  }
}

export async function listMessages(
  supabase: TypedSupabaseClient,
  threadId: string,
  limit = 50,
  before?: string,
): Promise<MessageResult[]> {
  const client = supabase as SupabaseClient<any>

  let query = client
    .from("dm_messages")
    .select(
      `
        *,
        attachments:dm_message_media(
          id,
          message_id,
          media_type,
          storage_path,
          mime_type,
          file_size,
          duration_seconds,
          file_name,
          created_at,
          source_storage_path,
          source_bucket
        ),
        read_receipts:dm_message_reads(
          id,
          message_id,
          user_id,
          read_at
        )
      `,
    )
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (before) {
    query = query.lt("created_at", before)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  const rows = (data ?? []) as Array<DirectMessage & {
    attachments: DirectMessageAttachment[]
    read_receipts: Array<{
      id: string
      message_id: string
      user_id: string
      read_at: string
    }>
  }>

  // Fetch replied messages for all messages that have replies
  const messagesWithReplies = await Promise.all(
    rows.map(async (row) => {
      const repliedToMessage = row.reply_to_message_id
        ? await fetchRepliedMessage(supabase, row.reply_to_message_id, threadId)
        : null

      return {
        ...row,
        attachments: row.attachments ?? [],
        read_receipts: row.read_receipts ?? [],
        replied_to_message: repliedToMessage,
      }
    }),
  )

  return messagesWithReplies
}

export async function appendMessage(
  supabase: TypedSupabaseClient,
  input: MessageInput,
): Promise<MessageResult> {
  const client = supabase as SupabaseClient<any>
  
  // Verify participant first
  const participant = await client
    .from("dm_participants")
    .select("*")
    .eq("thread_id", input.threadId)
    .eq("user_id", input.senderId)
    .maybeSingle()

  if (participant.error) {
    throw participant.error
  }

  if (!participant.data) {
    throw new Error("Not a participant in this thread")
  }

  // Allow messaging for all statuses except blocked
  if (participant.data.status === "blocked") {
    throw new Error("You cannot send messages in this conversation")
  }

  // Validate reply if provided (database trigger will also validate, but early validation gives better errors)
  if (input.replyToMessageId) {
    const repliedMessage = await fetchRepliedMessage(supabase, input.replyToMessageId, input.threadId)
    if (!repliedMessage) {
      throw new Error("Replied message not found, deleted, or not in this conversation")
    }
  }

  const attachments = input.attachments ?? []
  const nowIso = new Date().toISOString()

  // Insert message (database trigger will validate reply_to_message_id)
  const inserted = await client
    .from("dm_messages")
    .insert({
      thread_id: input.threadId,
      sender_id: input.senderId,
      message_type: input.messageType ?? "text",
      content: input.content ?? null,
      metadata: input.metadata ?? null,
      reply_to_message_id: input.replyToMessageId ?? null,
      has_attachments: attachments.length > 0,
    })
    .select("*")
    .single()

  if (inserted.error) {
    throw inserted.error
  }

  const messageRow = inserted.data as DirectMessage
  let storedAttachments: DirectMessageAttachment[] = []

  // Insert attachments if any
  if (attachments.length > 0) {
    const rows = attachments.map((item) => ({
      message_id: messageRow.id,
      media_type: item.mediaType,
      storage_path: item.storagePath,
      mime_type: item.mimeType ?? null,
      file_size: item.fileSize ?? null,
      duration_seconds: item.durationSeconds ?? null,
      file_name: item.fileName ?? null,
    }))

    const { data: attachmentData, error: attachmentError } = await client
      .from("dm_message_media")
      .insert(rows)
      .select("*")

    if (attachmentError) {
      // Rollback: Delete the message if attachments fail
      await client.from("dm_messages").delete().eq("id", messageRow.id)
      throw new Error(`Failed to attach media: ${attachmentError.message}`)
    }

    storedAttachments = (attachmentData ?? []) as DirectMessageAttachment[]
  }

  // Update participant last_seen and last_read (fire and forget - non-critical)
  void (async () => {
    const { error: participantUpdateError } = await client
      .from("dm_participants")
      .update({
        last_seen_at: nowIso,
        last_read_at: nowIso,
      })
      .eq("id", participant.data.id)

    if (participantUpdateError) {
      console.error("[appendMessage] Failed to update participant timestamps:", participantUpdateError)
    }
  })()

  // Fetch replied_to_message using helper function (already validated above)
  const repliedToMessage = await fetchRepliedMessage(
    supabase,
    messageRow.reply_to_message_id ?? null,
    input.threadId,
  )

  return {
    ...messageRow,
    attachments: storedAttachments,
    replied_to_message: repliedToMessage,
  }
}

export async function markThreadRead(
  supabase: TypedSupabaseClient,
  threadId: string,
  userId: string,
) {
  const now = new Date().toISOString()
  const client = supabase as SupabaseClient<any>

  const { error } = await client
    .from("dm_participants")
    .update({
      last_seen_at: now,
      last_read_at: now,
    })
    .eq("thread_id", threadId)
    .eq("user_id", userId)

  if (error) {
    throw error
  }
}

export async function markMessagesAsRead(
  supabase: TypedSupabaseClient,
  threadId: string,
  userId: string,
  messageIds: string[],
): Promise<number> {
  if (messageIds.length === 0) {
    return 0
  }

  const client = supabase as SupabaseClient<any>

  // Use the database function to efficiently mark messages as read
  const { data, error } = await client.rpc("mark_messages_as_read", {
    p_thread_id: threadId,
    p_user_id: userId,
    p_message_ids: messageIds,
  })

  if (error) {
    throw error
  }

  return data ?? 0
}

export async function getThreadById(
  supabase: TypedSupabaseClient,
  threadId: string,
): Promise<DirectMessageThread | null> {
  const client = supabase as SupabaseClient<any>
  const { data, error } = await client
    .from("dm_threads")
    .select("*")
    .eq("id", threadId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? (data as DirectMessageThread) : null
}

// DEPRECATED: Message requests are no longer used - participants are always created as active
// Keeping function for backwards compatibility but it's a no-op
export async function acceptMessageRequest(
  supabase: TypedSupabaseClient,
  threadId: string,
  userId: string,
): Promise<AcceptMessageRequestResult> {
  // Message requests are no longer used - all participants are active by default
  // This function is kept for backwards compatibility but does nothing
  const thread = await getThreadById(supabase, threadId)
  if (!thread) {
    throw new Error("Conversation not found")
  }

  const participants = await loadThreadParticipants(supabase, threadId)
  const participant = participants.find((p) => p.user_id === userId)
  if (!participant) {
    throw new Error("You do not have access to this conversation")
  }

  const summaries = await getConversationSummaries(supabase, userId, { limit: 1 })
  const conversation = summaries.find((s) => s.thread_id === threadId) ?? null

  return {
    thread,
    participant,
    conversation,
  }
}

