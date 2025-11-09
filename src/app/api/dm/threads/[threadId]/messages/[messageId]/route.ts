import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

// DELETE endpoint for removing a message
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ threadId: string; messageId: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const params = await Promise.resolve(context.params)
    const { threadId, messageId } = params

    if (!threadId || !messageId) {
      return NextResponse.json(
        { error: "Thread ID and Message ID are required" },
        { status: 400 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify the message belongs to this thread and is sent by the user
    const { data: message, error: fetchError } = await supabase
      .from("dm_messages")
      .select("id, sender_id, thread_id")
      .eq("id", messageId)
      .eq("thread_id", threadId)
      .eq("sender_id", user.id)
      .single()

    if (fetchError || !message) {
      return NextResponse.json(
        { error: "Message not found or unauthorized" },
        { status: 404 }
      )
    }

    // Delete the message (RLS policy ensures only sender can delete)
    const { error: deleteError } = await supabase
      .from("dm_messages")
      .delete()
      .eq("id", messageId)

    if (deleteError) {
      console.error("[DELETE /api/dm/threads/[threadId]/messages/[messageId]]", deleteError)
      return NextResponse.json(
        { error: "Failed to delete message" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[DELETE /api/dm/threads/[threadId]/messages/[messageId]]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}