import { NextRequest, NextResponse } from "next/server"

import { acceptMessageRequest } from "@/lib/chat"
import { createServerSupabaseClient } from "@/lib/supabase-server"

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> | { threadId: string } },
) {
  const params = await Promise.resolve(context.params)
  const threadParam = params?.threadId
  const threadId = typeof threadParam === "string" ? threadParam.trim() : ""

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

    const result = await acceptMessageRequest(supabase, threadId, user.id)

    return NextResponse.json({
      success: true,
      thread: result.thread,
      participant: result.participant,
      conversation: result.conversation,
    })
  } catch (error) {
    console.error("[api/dm/threads/accept][POST]", error)
    if (error && typeof error === "object" && "message" in error) {
      const message = String((error as { message?: string }).message ?? "Failed to accept request")
      const normalized = message.trim() || "Failed to accept request"

      if (normalized.toLowerCase().includes("unauthorized")) {
        return errorResponse(normalized, 401)
      }

      return errorResponse(normalized, 400)
    }

    return errorResponse("Failed to accept request", 500)
  }
}



