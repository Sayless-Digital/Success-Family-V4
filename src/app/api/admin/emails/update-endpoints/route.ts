import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getSetupInstructions } from "@/lib/resend-email"

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

    // With Resend, webhook URL is configured once in the dashboard
    // for the entire domain wildcard (*@successfamily.online)
    // No need to update individual endpoints
    
    return NextResponse.json({
      message: "Resend uses wildcard domain routing - no individual endpoint updates needed",
      info: "Configure the webhook URL once in Resend dashboard for *@yourdomain.com",
      setupInstructions: getSetupInstructions(),
      recommendedWebhookUrl: webhookUrl,
      note: "All emails to any address @yourdomain.com will automatically route to your webhook"
    })
  } catch (error: any) {
    console.error("Error in bulk endpoint update:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

