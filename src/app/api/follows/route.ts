import { NextRequest, NextResponse } from "next/server"

import { createServerSupabaseClient } from "@/lib/supabase-server"
import { followUser, getFollowStatus, unfollowUser } from "@/lib/follow"

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return jsonError("Unauthorized", 401)
    }

    const targetUserId = request.nextUrl.searchParams.get("userId")
    if (!targetUserId) {
      return jsonError("Missing userId parameter", 400)
    }

    const status = await getFollowStatus(supabase, user.id, targetUserId)
    return NextResponse.json({ status })
  } catch (error) {
    console.error("[api/follows][GET]", error)
    return jsonError("Failed to fetch follow status", 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const targetUserId = body?.targetUserId as string | undefined

    if (!targetUserId) {
      return jsonError("targetUserId is required", 400)
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return jsonError("Unauthorized", 401)
    }

    if (targetUserId === user.id) {
      return jsonError("You cannot follow yourself", 400)
    }

    await followUser(supabase, user.id, targetUserId)
    const status = await getFollowStatus(supabase, user.id, targetUserId)

    return NextResponse.json({ status }, { status: 200 })
  } catch (error) {
    console.error("[api/follows][POST]", error)
    return jsonError("Failed to follow user", 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const targetUserId = body?.targetUserId as string | undefined

    if (!targetUserId) {
      return jsonError("targetUserId is required", 400)
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return jsonError("Unauthorized", 401)
    }

    if (targetUserId === user.id) {
      return jsonError("You cannot unfollow yourself", 400)
    }

    await unfollowUser(supabase, user.id, targetUserId)
    const status = await getFollowStatus(supabase, user.id, targetUserId)

    return NextResponse.json({ status }, { status: 200 })
  } catch (error) {
    console.error("[api/follows][DELETE]", error)
    return jsonError("Failed to unfollow user", 500)
  }
}


