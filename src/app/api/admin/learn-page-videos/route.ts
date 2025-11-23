import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin role
    const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (me?.role !== 'admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('uploaded_videos')
      .select('id, title, storage_url, created_at')
      .eq('is_learn_page_video', true)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error("[Learn Page Videos API] Error fetching videos:", error)
      return NextResponse.json(
        { error: "Failed to fetch videos" },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error("[Learn Page Videos API] Unexpected error:", error)
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred" },
      { status: 500 }
    )
  }
}


