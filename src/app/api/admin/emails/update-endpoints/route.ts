import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { updateInboundEndpoint } from "@/lib/inbound-email"

/**
 * Admin endpoint to update all email endpoint URLs to the current environment URL
 * This fixes endpoints that were created with localhost URLs in development
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check if user is authenticated and is an admin
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    const { data: userProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (userProfile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
    }

    // Get webhook URL (always use current environment URL)
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    
    // Ensure production URLs use HTTPS
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        baseUrl = `http://${baseUrl}`
      } else {
        baseUrl = `https://${baseUrl}`
      }
    }
    
    if (process.env.NODE_ENV === 'production' && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
      baseUrl = baseUrl.replace(/^http:\/\//, 'https://')
    }
    
    const webhookUrl = `${baseUrl}/api/emails/webhook`

    // Get all users with email addresses that have endpoint IDs
    const { data: userEmails, error: fetchError } = await supabase
      .from("user_emails")
      .select("id, user_id, email_address, inbound_endpoint_id")
      .eq("is_active", true)
      .not("inbound_endpoint_id", "is", null)

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch user emails", details: fetchError.message },
        { status: 500 }
      )
    }

    if (!userEmails || userEmails.length === 0) {
      return NextResponse.json({
        message: "No email endpoints found to update",
        updated: 0,
        failed: 0,
      })
    }

    // Update each endpoint
    const results = {
      updated: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const userEmail of userEmails) {
      if (!userEmail.inbound_endpoint_id) continue

      try {
        await updateInboundEndpoint(
          userEmail.inbound_endpoint_id,
          webhookUrl,
          userEmail.user_id
        )
        results.updated++
        console.log(`[Admin] Updated endpoint for ${userEmail.email_address}`)
      } catch (error: any) {
        results.failed++
        const errorMsg = `Failed to update ${userEmail.email_address}: ${error.message}`
        results.errors.push(errorMsg)
        console.error(`[Admin] ${errorMsg}`)
      }
    }

    return NextResponse.json({
      message: `Updated ${results.updated} endpoint(s), ${results.failed} failed`,
      updated: results.updated,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined,
      webhookUrl,
    })
  } catch (error: any) {
    console.error("Error in bulk endpoint update:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

