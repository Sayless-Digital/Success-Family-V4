import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "all" // "all", "sent", "received"
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    // Build query
    let query = supabase
      .from("user_email_messages")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (type !== "all") {
      query = query.eq("message_type", type)
    }

    const { data: messages, error } = await query

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch messages", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      messages: messages || [],
      count: messages?.length || 0,
    })
  } catch (error: any) {
    console.error("Error in inbox:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

// Mark message as read
export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { messageId, isRead, isArchived } = body

    if (!messageId) {
      return NextResponse.json({ error: "Message ID is required" }, { status: 400 })
    }

    const updateData: any = {}
    if (typeof isRead === "boolean") {
      updateData.is_read = isRead
      if (isRead) {
        updateData.read_at = new Date().toISOString()
      } else {
        updateData.read_at = null
      }
    }
    if (typeof isArchived === "boolean") {
      updateData.is_archived = isArchived
      if (isArchived) {
        updateData.archived_at = new Date().toISOString()
      } else {
        updateData.archived_at = null
      }
    }

    const { error } = await supabase
      .from("user_email_messages")
      .update(updateData)
      .eq("id", messageId)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json(
        { error: "Failed to update message", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error updating message:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

