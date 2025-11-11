import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { sendEmail } from "@/lib/email"

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { to, subject, html, text } = body

    if (!to || !subject || (!html && !text)) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, and html or text" },
        { status: 400 }
      )
    }

    // Get user's email address
    const { data: userEmail } = await supabase
      .from("user_emails")
      .select("email_address")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()

    if (!userEmail) {
      return NextResponse.json(
        { error: "No active email address found. Please set up your email first." },
        { status: 400 }
      )
    }

    // Get user profile for from name
    const { data: userProfile } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single()

    const fromName = userProfile
      ? `${userProfile.first_name} ${userProfile.last_name}`
      : "Success Family User"
    const from = `${fromName} <${userEmail.email_address}>`

    // Send email
    try {
      await sendEmail({
        from,
        to,
        subject,
        html: html || text,
      })

      // Store sent email in database
      await supabase.from("user_email_messages").insert({
        user_id: user.id,
        email_address: userEmail.email_address,
        message_type: "sent",
        from_email: userEmail.email_address,
        from_name: fromName,
        to_email: Array.isArray(to) ? to.join(", ") : to,
        to_name: null,
        subject,
        html_content: html || null,
        text_content: text || null,
        sent_at: new Date().toISOString(),
      })

      return NextResponse.json({
        success: true,
        message: "Email sent successfully",
      })
    } catch (emailError: any) {
      return NextResponse.json(
        { error: "Failed to send email", details: emailError.message },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Error in send email:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

