import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase-server"
import { env } from "@/lib/env"

// Webhook endpoint for receiving emails from Resend
export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  
  try {
    // Log the incoming request for debugging
    console.log(`[Webhook ${requestId}] Request received:`, {
      method: request.method,
      url: request.url,
      timestamp: new Date().toISOString(),
      headers: {
        'x-endpoint-id': request.headers.get('x-endpoint-id'),
        'x-webhook-event': request.headers.get('x-webhook-event'),
        'x-email-id': request.headers.get('x-email-id'),
        'user-agent': request.headers.get('user-agent'),
        'content-type': request.headers.get('content-type'),
      },
    })

    // Optional: Verify webhook signature from Resend
    // Resend uses Svix for webhook signatures
    // You can add signature verification here if needed
    // See: https://resend.com/docs/dashboard/webhooks/verify-signature

    // Parse request body with timeout protection
    let body: any
    try {
      // Set a timeout for reading the request body (10 seconds)
      const bodyPromise = request.json()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Request body read timeout")), 10000)
      )
      body = await Promise.race([bodyPromise, timeoutPromise]) as any
      console.log(`[Webhook ${requestId}] Payload received (size: ${JSON.stringify(body).length} chars)`)
    } catch (parseError: any) {
      console.error(`[Webhook ${requestId}] Failed to parse JSON:`, parseError)
      return NextResponse.json({ 
        error: "Invalid JSON", 
        details: parseError.message,
        requestId 
      }, { status: 400 })
    }
    
    // Validate webhook payload - Resend structure
    // Resend webhook payload for email.received event:
    // { type: "email.received", created_at: "...", data: { ... } }
    if (!body || typeof body !== 'object') {
      console.error("[Webhook] Invalid payload - not an object")
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 })
    }

    // Check event type
    if (body.type !== 'email.received') {
      console.log(`[Webhook ${requestId}] Ignoring event type: ${body.type}`)
      return NextResponse.json({ success: true, message: "Event ignored" }, { status: 200 })
    }

    // Extract email data from Resend payload
    const data = body.data
    if (!data) {
      console.error("[Webhook] No data in payload. Body:", JSON.stringify(body, null, 2))
      return NextResponse.json({ error: "No data in payload" }, { status: 400 })
    }

    // Extract recipient email from Resend format
    // Resend provides: to, from, subject, html, text, etc.
    let recipientEmail: string | null = null
    
    if (data.to) {
      if (Array.isArray(data.to)) {
        recipientEmail = data.to[0] // Get first recipient
      } else if (typeof data.to === 'string') {
        recipientEmail = data.to
      }
    }
    
    if (!recipientEmail) {
      console.error(`[Webhook ${requestId}] No recipient email found. Payload:`, JSON.stringify(body, null, 2))
      return NextResponse.json({ error: "No recipient email found", requestId }, { status: 400 })
    }
    
    // Clean up email address - extract from "Name <email@domain.com>" format
    const emailMatch = recipientEmail.match(/<([^>]+)>/) || recipientEmail.match(/([\w\.-]+@[\w\.-]+\.\w+)/)
    if (emailMatch) {
      recipientEmail = emailMatch[1] || emailMatch[0]
    }
    recipientEmail = recipientEmail.trim()

    console.log(`[Webhook ${requestId}] Recipient email extracted: ${recipientEmail}`)

    // Find user by email address
    // Use service role client to bypass RLS since webhooks don't have an authenticated user
    const supabase = createServiceRoleSupabaseClient()
    
    // Try to find the user with case-insensitive matching
    // First try exact match (case-insensitive)
    const { data: userEmail, error: userEmailError } = await supabase
      .from("user_emails")
      .select("user_id, email_address")
      .ilike("email_address", recipientEmail) // Case-insensitive match
      .eq("is_active", true)
      .single()

    // If not found, try to find all emails and log them for debugging
    if (userEmailError || !userEmail) {
      console.error(`[Webhook ${requestId}] No user found for email: ${recipientEmail}`)
      console.error(`[Webhook ${requestId}] Query error:`, userEmailError)
      
      // Try to get all active emails for debugging
      const { data: allEmails } = await supabase
        .from("user_emails")
        .select("email_address")
        .eq("is_active", true)
        .limit(10)
      
      console.error(`[Webhook ${requestId}] Available emails:`, allEmails?.map(e => e.email_address))
      console.error(`[Webhook ${requestId}] Email payload recipient fields:`, {
        to: data.to,
        from: data.from,
      })
      
      // Return 200 to prevent Resend from retrying
      // We don't want to retry if the user doesn't exist
      return NextResponse.json({ 
        success: false, 
        message: `User not found for this email address: ${recipientEmail}`,
        requestId,
        searchedEmail: recipientEmail
      }, { status: 200 })
    }

    console.log(`[Webhook ${requestId}] Found user:`, userEmail.user_id)

    // Extract from email and name from Resend format
    let fromEmail: string | null = null
    let fromName: string | null = null
    
    if (data.from) {
      const fromStr = Array.isArray(data.from) ? data.from[0] : data.from
      const match = fromStr.match(/^(.+?)\s*<([^>]+)>$/)
      if (match) {
        fromName = match[1]?.trim() || null
        fromEmail = match[2]
      } else {
        const emailMatch = fromStr.match(/([\w\.-]+@[\w\.-]+\.\w+)/)
        fromEmail = emailMatch ? emailMatch[1] : fromStr
      }
    }
    
    if (!fromEmail) {
      fromEmail = 'unknown@example.com'
      console.warn(`[Webhook ${requestId}] No from email found, using default`)
    }

    // Extract email content from Resend format
    const subject = data.subject || "(No Subject)"
    const htmlContent = data.html || null
    const textContent = data.text || null
    const receivedAt = body.created_at || new Date().toISOString()
    const resendEmailId = data.email_id || data.id || null

    console.log(`[Webhook ${requestId}] Storing email:`, {
      subject,
      fromEmail,
      fromName,
      recipientEmail,
      hasHtml: !!htmlContent,
      hasText: !!textContent,
    })

    // Store received email in database
    const { error: insertError } = await supabase
      .from("user_email_messages")
      .insert({
        user_id: userEmail.user_id,
        email_address: recipientEmail,
        message_type: "received",
        inbound_email_id: resendEmailId,
        from_email: fromEmail,
        from_name: fromName,
        to_email: recipientEmail,
        to_name: null,
        subject,
        html_content: htmlContent,
        text_content: textContent,
        received_at: receivedAt,
        is_read: false,
      })

    if (insertError) {
      console.error(`[Webhook ${requestId}] Error storing email:`, insertError)
      return NextResponse.json(
        { error: "Failed to store email", details: insertError.message, requestId },
        { status: 500 }
      )
    }

    console.log(`[Webhook ${requestId}] Email stored successfully`)
    return NextResponse.json({ 
      success: true, 
      message: "Email received and stored",
      requestId 
    }, { status: 200 })
  } catch (error: any) {
    console.error(`[Webhook ${requestId}] Unexpected error:`, error)
    console.error(`[Webhook ${requestId}] Error stack:`, error.stack)
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: error.message,
        requestId 
      },
      { status: 500 }
    )
  }
}

// Export a GET handler for testing and health checks
export async function GET(request: Request) {
  const url = new URL(request.url)
  const healthCheck = url.searchParams.get('health') === 'check'
  
  if (healthCheck) {
    // Perform a basic health check
    try {
      const supabase = createServiceRoleSupabaseClient()
      // Quick database connection test
      const { error } = await supabase.from('user_emails').select('id').limit(1)
      
      return NextResponse.json({ 
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: error ? "error" : "connected",
        endpoint: "/api/emails/webhook",
        method: "POST"
      }, { status: error ? 503 : 200 })
    } catch (error: any) {
      return NextResponse.json({ 
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error.message 
      }, { status: 503 })
    }
  }
  
  return NextResponse.json({ 
    message: "Email webhook endpoint", 
    status: "active",
    timestamp: new Date().toISOString(),
    method: "POST",
    path: "/api/emails/webhook",
    healthCheck: "/api/emails/webhook?health=check"
  })
}
