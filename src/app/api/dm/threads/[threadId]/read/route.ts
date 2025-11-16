import { NextRequest, NextResponse } from "next/server"

import { createServerSupabaseClient } from "@/lib/supabase-server"

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(
  _request: NextRequest,
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

    const now = new Date().toISOString()

    const { error } = await supabase
      .from("dm_participants")
      .update({
        last_seen_at: now,
        last_read_at: now,
      })
      .eq("thread_id", threadId)
      .eq("user_id", user.id)

    if (error) {
      return errorResponse("Failed to update read status", 500)
    }

    return NextResponse.json({ success: true, last_read_at: now })
  } catch (error) {
    console.error("[api/dm/threads/read][POST]", error)
    return errorResponse("Failed to update read status", 500)
  }
}











