import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase-server"
import { env } from "@/lib/env"

// Webhook endpoint for receiving emails from Inbound
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

    // Optional: Verify webhook secret if configured
    // Inbound sends headers automatically - you don't need to add custom headers
    // If you want to add security, you can:
    // 1. Set INBOUND_WEBHOOK_SECRET in your .env file
    // 2. Configure a verification token in your Inbound endpoint settings
    // For now, we'll accept all requests (you can add verification later if needed)
    
    // If you set INBOUND_WEBHOOK_SECRET, uncomment this section:
    // const webhookSecret = request.headers.get("X-Inbound-Secret") || 
    //                      request.headers.get("x-inbound-secret") ||
    //                      request.headers.get("Authorization")?.replace("Bearer ", "")
    // 
    // if (env.INBOUND_WEBHOOK_SECRET && webhookSecret && webhookSecret !== env.INBOUND_WEBHOOK_SECRET) {
    //   console.warn("[Webhook] Secret mismatch")
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    // }

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
    
    // Validate webhook payload - check if it has an email property
    // Inbound webhook payload structure: { email: InboundWebhookEmail }
    if (!body || typeof body !== 'object') {
      console.error("[Webhook] Invalid payload - not an object")
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 })
    }

    // Extract email from payload
    const email = body.email
    if (!email) {
      console.error("[Webhook] No email in payload. Body:", JSON.stringify(body, null, 2))
      return NextResponse.json({ error: "No email in payload" }, { status: 400 })
    }

    // Extract recipient email - Inbound uses InboundEmailAddress structure
    // which has: { text: string, addresses: Array<{name: string | null, address: string | null}> }
    // Also check the recipient field directly which is always present
    let recipientEmail: string | null = null
    
    // First, try the recipient field (most reliable)
    if (email.recipient) {
      recipientEmail = email.recipient
    }
    
    // Then try the to field
    if (!recipientEmail && email.to) {
      // Handle InboundEmailAddress structure
      if (email.to.addresses && Array.isArray(email.to.addresses) && email.to.addresses.length > 0) {
        // Get the first recipient address
        const firstAddress = email.to.addresses.find((addr: any) => addr.address)
        recipientEmail = firstAddress?.address || null
      }
      // Fallback to text field
      if (!recipientEmail && email.to.text) {
        // Extract email from "Name <email@domain.com>" format or just email
        const match = email.to.text.match(/<([^>]+)>/) || email.to.text.match(/([\w\.-]+@[\w\.-]+\.\w+)/)
        recipientEmail = match ? (match[1] || match[0]) : email.to.text.trim()
      }
      // Fallback to string format
      if (!recipientEmail && typeof email.to === 'string') {
        recipientEmail = email.to
      }
    }
    
    // Additional fallbacks
    if (!recipientEmail) {
      recipientEmail = email.to_email || email.destination || email.address
    }
    
    if (!recipientEmail) {
      console.error(`[Webhook ${requestId}] No recipient email found. Payload:`, JSON.stringify(body, null, 2))
      return NextResponse.json({ error: "No recipient email found", requestId }, { status: 400 })
    }
    
    // Clean up email address
    recipientEmail = recipientEmail.replace(/^<|>$/g, '').trim()
    const emailMatch = recipientEmail.match(/([\w\.-]+@[\w\.-]+\.\w+)/)
    if (emailMatch) {
      recipientEmail = emailMatch[1]
    }

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
        recipient: email.recipient,
        to: email.to,
        to_email: email.to_email,
        destination: email.destination,
        address: email.address,
      })
      
      // Return 200 to prevent Inbound from retrying
      // We don't want to retry if the user doesn't exist
      return NextResponse.json({ 
        success: false, 
        message: `User not found for this email address: ${recipientEmail}`,
        requestId,
        searchedEmail: recipientEmail
      }, { status: 200 })
    }

    console.log(`[Webhook ${requestId}] Found user:`, userEmail.user_id)

    // Extract from email and name - same structure as 'to'
    let fromEmail: string | null = null
    let fromName: string | null = null
    
    if (email.from) {
      // Handle InboundEmailAddress structure
      if (email.from.addresses && Array.isArray(email.from.addresses) && email.from.addresses.length > 0) {
        const firstAddress = email.from.addresses.find((addr: any) => addr.address)
        fromEmail = firstAddress?.address || null
        fromName = firstAddress?.name || null
      }
      // Fallback to text field
      if (!fromEmail && email.from.text) {
        const match = email.from.text.match(/^(.+?)\s*<([^>]+)>$/) || email.from.text.match(/([\w\.-]+@[\w\.-]+\.\w+)/)
        if (match) {
          if (match[2]) {
            fromName = match[1]?.trim() || null
            fromEmail = match[2]
          } else if (match[1] && match[1].includes('@')) {
            fromEmail = match[1]
          }
        }
        if (!fromEmail) {
          fromEmail = email.from.text.trim()
        }
      }
      // Fallback to string format
      if (!fromEmail && typeof email.from === 'string') {
        const match = email.from.match(/^(.+?)\s*<([^>]+)>$/) || email.from.match(/([\w\.-]+@[\w\.-]+\.\w+)/)
        if (match && match[2]) {
          fromName = match[1]?.trim() || null
          fromEmail = match[2]
        } else {
          fromEmail = email.from
        }
      }
    }
    
    // Fallback to sender field
    if (!fromEmail && email.sender) {
      if (typeof email.sender === 'string') {
        const match = email.sender.match(/^(.+?)\s*<([^>]+)>$/) || email.sender.match(/([\w\.-]+@[\w\.-]+\.\w+)/)
        fromEmail = match ? (match[2] || match[1]) : email.sender
      } else if (email.sender.address) {
        fromEmail = email.sender.address
        fromName = email.sender.name || fromName
      }
    }
    
    // Clean up from email
    if (fromEmail) {
      fromEmail = fromEmail.replace(/^<|>$/g, '').trim()
      const emailMatch = fromEmail.match(/([\w\.-]+@[\w\.-]+\.\w+)/)
      if (emailMatch) {
        fromEmail = emailMatch[1]
      }
    }
    
    if (!fromEmail) {
      fromEmail = 'unknown@example.com'
      console.warn(`[Webhook ${requestId}] No from email found, using default`)
    }

    // Extract email content
    const subject = email.subject || email.parsedData?.subject || "(No Subject)"
    const htmlContent = email.cleanedContent?.html || email.htmlBody || email.html || email.parsedData?.html || null
    const textContent = email.cleanedContent?.text || email.textBody || email.text || email.parsedData?.text || null
    const receivedAt = email.receivedAt || email.received_at || email.timestamp || email.date || new Date().toISOString()
    const inboundEmailId = email.id || email.emailId || email.messageId || null

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
        inbound_email_id: inboundEmailId,
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
