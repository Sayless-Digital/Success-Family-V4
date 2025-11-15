import { NextRequest, NextResponse } from "next/server"

import { markMessagesAsRead, loadThreadParticipants } from "@/lib/chat"
import { createServerSupabaseClient } from "@/lib/supabase-server"

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(
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

    // Verify user is a participant in the thread
    const participants = await loadThreadParticipants(supabase, threadId)
    const current = participants.find((participant) => participant.user_id === user.id)

    if (!current) {
      return errorResponse("You do not have access to this conversation", 403)
    }

    const body = await request.json().catch(() => null)
    const messageIds = Array.isArray(body?.messageIds) 
      ? body.messageIds.filter((id: unknown): id is string => typeof id === "string")
      : []

    if (messageIds.length === 0) {
      return errorResponse("At least one message ID is required", 400)
    }

    const count = await markMessagesAsRead(supabase, threadId, user.id, messageIds)

    return NextResponse.json({ 
      success: true, 
      markedCount: count,
      messageIds: messageIds.slice(0, count) // Return the IDs that were actually marked
    })
  } catch (error) {
    console.error("[api/dm/threads/messages/read][POST]", error)

    if (error && typeof error === "object" && "message" in error) {
      const message = String((error as { message?: string }).message ?? "Failed to mark messages as read")
      return errorResponse(message, 400)
    }

    return errorResponse("Failed to mark messages as read", 500)
  }
}



