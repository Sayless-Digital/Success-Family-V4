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

    // Get user's email address
    const { data: userEmail, error } = await supabase
      .from("user_emails")
      .select("email_address, is_active, inbound_address_id, inbound_endpoint_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      return NextResponse.json(
        { error: "Failed to fetch email address", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      email: userEmail?.email_address || null,
      isConfigured: !!userEmail?.inbound_address_id,
    })
  } catch (error: any) {
    console.error("Error in get email address:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

