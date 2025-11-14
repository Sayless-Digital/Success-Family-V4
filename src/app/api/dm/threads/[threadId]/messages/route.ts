import { NextRequest, NextResponse } from "next/server"

import { appendMessage, listMessages, loadThreadParticipants } from "@/lib/chat"
import { canUserInteractWithThread } from "@/lib/chat-shared"
import { createServerSupabaseClient } from "@/lib/supabase-server"

const DEFAULT_PAGE_SIZE = 50

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

interface AttachmentPayload {
  storagePath?: string
  mediaType?: "image" | "audio" | "file" | "video"
  mimeType?: string
  fileSize?: number
  durationSeconds?: number
  fileName?: string
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> | { threadId: string } },
) {
  const params = await Promise.resolve(context.params)
  const threadId = params?.threadId?.trim()

  if (!threadId) {
    return errorResponse("Thread ID is required", 400)
  }

  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return errorResponse("Unauthorized", 401)
    }

    const participants = await loadThreadParticipants(supabase, threadId)
    const current = participants.find((participant) => participant.user_id === user.id)

    if (!current) {
      return errorResponse("You do not have access to this conversation", 403)
    }

    const limitParam = request.nextUrl.searchParams.get("limit")
    const before = request.nextUrl.searchParams.get("before") ?? undefined
    const limit = limitParam ? Math.min(Number(limitParam) || DEFAULT_PAGE_SIZE, 100) : DEFAULT_PAGE_SIZE

    const messages = await listMessages(supabase, threadId, limit, before ?? undefined)
    const hasMore = messages.length === limit
    const nextCursor = hasMore ? messages[messages.length - 1]?.created_at ?? null : null

    return NextResponse.json({
      messages: messages.reverse(),
      pageInfo: {
        hasMore,
        nextCursor,
      },
    })
  } catch (error) {
    console.error("[api/dm/messages][GET]", error)
    return errorResponse("Failed to load messages", 500)
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> | { threadId: string } },
) {
  const params = await Promise.resolve(context.params)
  const rawThreadId = params?.threadId
  const threadId = typeof rawThreadId === "string" ? rawThreadId.trim() : ""

  if (!threadId) {
    return errorResponse("Select a conversation before sending messages.", 400)
  }

  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return errorResponse("Unauthorized", 401)
    }

    const participants = await loadThreadParticipants(supabase, threadId)
    const current = participants.find((participant) => participant.user_id === user.id)

    if (!canUserInteractWithThread(current)) {
      return errorResponse("You cannot send messages in this conversation", 403)
    }

    const body = await request.json().catch(() => null)

    const rawContent = typeof body?.content === "string" ? body.content : undefined
    const trimmedContent = rawContent?.trim()
    const messageType = body?.messageType as "text" | "system" | undefined

    const attachmentsPayload: AttachmentPayload[] = Array.isArray(body?.attachments) ? body.attachments : []
    const attachments = attachmentsPayload.map((item) => ({
      storagePath: typeof item.storagePath === "string" ? item.storagePath : "",
      mediaType: item.mediaType,
      mimeType: item.mimeType,
      fileSize: item.fileSize,
      durationSeconds: item.durationSeconds,
      fileName: typeof item.fileName === "string" ? item.fileName : undefined,
    }))

    const allowedMediaTypes = new Set(["image", "audio", "file", "video"])

    // Validate attachments with detailed error messages
    for (const attachment of attachments) {
      if (!attachment.storagePath) {
        console.error("[api/dm/messages][POST] Missing storagePath in attachment:", attachment)
        return errorResponse("Attachment is missing storage path", 400)
      }
      if (!attachment.storagePath.startsWith("dm-media/")) {
        console.error("[api/dm/messages][POST] Invalid storagePath (must start with 'dm-media/'):", attachment.storagePath)
        return errorResponse(`Invalid storage path: ${attachment.storagePath}. Must start with 'dm-media/'`, 400)
      }
      if (!attachment.mediaType) {
        console.error("[api/dm/messages][POST] Missing mediaType in attachment:", attachment)
        return errorResponse("Attachment is missing media type", 400)
      }
      if (!allowedMediaTypes.has(attachment.mediaType)) {
        console.error("[api/dm/messages][POST] Invalid mediaType:", attachment.mediaType)
        return errorResponse(`Invalid media type: ${attachment.mediaType}. Allowed types: image, audio, file`, 400)
      }
    }

    if ((!trimmedContent || trimmedContent.length === 0) && attachments.length === 0) {
      return errorResponse("A message requires content or at least one attachment", 400)
    }

    const normalizedAttachments = attachments.map((attachment) => ({
      storagePath: attachment.storagePath,
      mediaType: attachment.mediaType as "image" | "audio" | "file" | "video",
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      durationSeconds: attachment.durationSeconds,
      fileName: attachment.fileName,
    }))

    const message = await appendMessage(supabase, {
      threadId,
      senderId: user.id,
      content: trimmedContent ?? null,
      messageType: messageType ?? "text",
      attachments: normalizedAttachments,
      replyToMessageId: body?.replyToMessageId ? String(body.replyToMessageId) : null,
      metadata: body?.metadata && typeof body.metadata === "object" ? body.metadata : null,
    })

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error("[api/dm/messages][POST]", error)

    if (error && typeof error === "object" && "message" in error) {
      const message = String((error as { message?: string }).message ?? "Failed to send message")
      const normalized = message.trim() || "Failed to send message"
      const lower = normalized.toLowerCase()

      if (lower.includes("unauthorized")) {
        return errorResponse(normalized, 401)
      }

      if (lower.includes("cannot send messages")) {
        return errorResponse(normalized, 403)
      }

      return errorResponse(normalized, 400)
    }

    return errorResponse("Failed to send message", 500)
  }
}

