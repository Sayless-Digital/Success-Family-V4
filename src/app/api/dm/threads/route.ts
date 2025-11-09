import { NextRequest, NextResponse } from "next/server"

import { createServerSupabaseClient } from "@/lib/supabase-server"
import { ensureThread, getConversationSummaries } from "@/lib/chat"
import { orderParticipants } from "@/lib/chat-shared"

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return errorResponse("Unauthorized", 401)
    }

    const limitParam = request.nextUrl.searchParams.get("limit")
    const search = request.nextUrl.searchParams.get("search") ?? undefined
    const limit = limitParam ? Math.min(Number(limitParam) || 30, 100) : 30

    const conversations = await getConversationSummaries(supabase, user.id, {
      limit,
      search,
    })

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error("[api/dm/threads][GET]", error)
    return errorResponse("Failed to load conversations", 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const peerUserId = body?.peerUserId as string | undefined

    if (!peerUserId) {
      return errorResponse("peerUserId is required", 400)
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return errorResponse("Unauthorized", 401)
    }

    if (peerUserId === user.id) {
      return errorResponse("You cannot open a conversation with yourself", 400)
    }

    // Ensure the peer exists to provide clearer error messaging
    const peerProfile = await supabase
      .from("users")
      .select("id, username, first_name, last_name, profile_picture")
      .eq("id", peerUserId)
      .maybeSingle()

    if (peerProfile.error) {
      throw peerProfile.error
    }

    if (!peerProfile.data) {
      return errorResponse("User not found", 404)
    }

    const result = await ensureThread(supabase, user.id, peerUserId)

    const orderedPair = orderParticipants(user.id, peerUserId)

    return NextResponse.json({
      thread: result.thread,
      viewer: result.viewer,
      peer: {
        ...result.peer,
        profile: peerProfile.data,
      },
      orderedPair,
      isNew: result.isNew,
    })
  } catch (error) {
    console.error("[api/dm/threads][POST]", error)
    return errorResponse("Failed to open conversation", 500)
  }
}

