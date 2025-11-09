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
      .select("id, username, first_name, last_name, profile_picture")
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

  // Use upsert with conflict resolution to prevent race conditions
  if (!thread) {
    const upserted = await client
      .from("dm_threads")
      .upsert(
        {
          user_a_id: userAId,
          user_b_id: userBId,
          initiated_by: viewerId,
        },
        {
          onConflict: "user_a_id,user_b_id",
          ignoreDuplicates: false,
        }
      )
      .select("*")
      .single()

    if (upserted.error) {
      // If upsert failed due to unique constraint, try to fetch again
      if (upserted.error.code === "23505") {
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
        throw upserted.error
      }
    } else {
      thread = upserted.data as DirectMessageThread
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
          created_at
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

  const rows = (data ?? []) as Array<DirectMessage & { attachments: DirectMessageAttachment[] }>

  return rows.map((row) => ({
    ...row,
    attachments: row.attachments ?? [],
  }))
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

  if (participant.data.status !== "active") {
    throw new Error("Conversation request must be accepted before sending messages")
  }

  const attachments = input.attachments ?? []
  const nowIso = new Date().toISOString()

  // Insert message
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

  return {
    ...messageRow,
    attachments: storedAttachments,
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

export async function acceptMessageRequest(
  supabase: TypedSupabaseClient,
  threadId: string,
  userId: string,
): Promise<AcceptMessageRequestResult> {
  const normalizedThreadId = threadId.trim()
  if (!normalizedThreadId) {
    throw new Error("Thread ID is required")
  }

  const client = supabase as SupabaseClient<any>

  const participantQuery = await client
    .from("dm_participants")
    .select("*")
    .eq("thread_id", normalizedThreadId)
    .eq("user_id", userId)
    .maybeSingle<ParticipantRow>()

  if (participantQuery.error) {
    throw participantQuery.error
  }

  const participantRow = participantQuery.data

  if (!participantRow) {
    throw new Error("You do not have access to this conversation")
  }

  if (participantRow.status === "blocked") {
    throw new Error("This conversation cannot be accepted")
  }

  const nowIso = new Date().toISOString()

  let updatedParticipant = participantRow

  let participantUpdateError: PostgrestError | null = null

  if (participantRow.status !== "active") {
    const participantUpdate = await client
      .from("dm_participants")
      .update({
        status: "active",
        last_seen_at: nowIso,
        last_read_at: nowIso,
      } satisfies ParticipantUpdate)
      .eq("id", participantRow.id)
      .select("*")
      .single<ParticipantRow>()

    if (participantUpdate.error) {
      participantUpdateError = participantUpdate.error
    } else if (participantUpdate.data) {
      updatedParticipant = participantUpdate.data
    }
  }

  if (participantUpdateError) {
    throw participantUpdateError
  }

  const existingThreadQuery = await client
    .from("dm_threads")
    .select("*")
    .eq("id", normalizedThreadId)
    .maybeSingle<ThreadRow>()

  if (existingThreadQuery.error) {
    throw existingThreadQuery.error
  }

  let currentThread = existingThreadQuery.data ?? null

  let threadRow: ThreadRow | null = null
  const shouldResolveRequest =
    participantRow.status !== "active" ||
    (currentThread?.request_required ?? true) ||
    (currentThread?.request_resolved_at ?? null) === null

  if (shouldResolveRequest) {
    const threadUpdate = await client
      .from("dm_threads")
      .update({
        request_required: false,
        request_resolved_at: nowIso,
      } satisfies ThreadUpdate)
      .eq("id", normalizedThreadId)
      .select("*")
      .maybeSingle<ThreadRow>()

    if (threadUpdate.error) {
      console.error("[chat.acceptMessageRequest] Failed to update thread metadata", threadUpdate.error)
    } else {
      threadRow = threadUpdate.data
    }
  }

  const finalThread = threadRow ?? currentThread

  const summaryQuery = await client
    .from("dm_conversation_summaries")
    .select("*")
    .eq("thread_id", normalizedThreadId)
    .eq("user_id", userId)
    .maybeSingle<ConversationSummaryRow>()

  if (summaryQuery.error) {
    throw summaryQuery.error
  }

  let conversation: ConversationListItem | null = null

  if (summaryQuery.data) {
    const summary = summaryQuery.data as DirectMessageConversationSummary

    let otherProfile: ConversationListItem["other_user_profile"] = null

    if (summary.other_user_id) {
      const profileQuery = await client
        .from("users")
        .select("id, username, first_name, last_name, profile_picture")
        .eq("id", summary.other_user_id)
        .maybeSingle<UserRow>()

      if (profileQuery.error) {
        throw profileQuery.error
      }

      if (profileQuery.data) {
        otherProfile = {
          id: profileQuery.data.id,
          username: profileQuery.data.username,
          first_name: profileQuery.data.first_name,
          last_name: profileQuery.data.last_name,
          profile_picture: profileQuery.data.profile_picture,
        }
      }
    }

    conversation = {
      ...summary,
      other_user_profile: otherProfile,
    }
  }

  if (!finalThread) {
    throw new Error("Conversation not found")
  }

  if (!conversation) {
    const otherUserId = finalThread.user_a_id === userId ? finalThread.user_b_id : finalThread.user_a_id
    conversation = {
      thread_id: finalThread.id,
      user_a_id: finalThread.user_a_id,
      user_b_id: finalThread.user_b_id,
      initiated_by: finalThread.initiated_by,
      request_required: finalThread.request_required ?? false,
      request_resolved_at: finalThread.request_resolved_at,
      last_message_at: finalThread.last_message_at,
      last_message_preview: finalThread.last_message_preview,
      last_message_sender_id: finalThread.last_message_sender_id,
      updated_at: finalThread.updated_at,
      user_id: userId,
      participant_status: (updatedParticipant.status as DMParticipantStatus) ?? "active",
      last_read_at: updatedParticipant.last_read_at ?? null,
      last_seen_at: updatedParticipant.last_seen_at ?? null,
      muted_at: updatedParticipant.muted_at ?? null,
      other_user_id: otherUserId,
      other_participant_status: null,
      other_last_read_at: null,
      other_last_seen_at: null,
      other_muted_at: null,
      other_user_profile: null,
    }
  } else {
    conversation = {
      ...conversation,
      request_required: false,
      request_resolved_at: conversation.request_resolved_at ?? finalThread.request_resolved_at ?? nowIso,
      participant_status: (updatedParticipant.status as DMParticipantStatus) ?? conversation.participant_status,
    }
  }

  return {
    thread: finalThread as DirectMessageThread,
    participant: updatedParticipant as DirectMessageParticipant,
    conversation,
  }
}


