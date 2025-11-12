import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createInboundEmailAddress } from "@/lib/inbound-email"

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

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user already has an email address
    const { data: existingEmail } = await supabase
      .from("user_emails")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()

    // If email already exists, return it without doing anything
    if (existingEmail) {
      return NextResponse.json({
        email: existingEmail.email_address,
        message: "Email address already exists",
      })
    }

    // Generate personalized email address for new users
    const { data: generatedEmail, error: emailError } = await supabase.rpc(
      "generate_personalized_email",
      {
        first_name: userProfile.first_name,
        last_name: userProfile.last_name,
      }
    )

    if (emailError || !generatedEmail) {
      return NextResponse.json(
        { error: "Failed to generate email address" },
        { status: 500 }
      )
    }

    const emailAddress = generatedEmail

    // Get webhook URL - ALWAYS use production URL for webhooks (even in dev)
    // Webhooks must be publicly accessible, so we always use the production URL
    // Priority: INBOUND_WEBHOOK_URL > NEXT_PUBLIC_APP_URL (if production) > hardcoded production URL
    let webhookUrl: string
    
    // First, try the dedicated webhook URL environment variable
    if (process.env.INBOUND_WEBHOOK_URL) {
      webhookUrl = process.env.INBOUND_WEBHOOK_URL
      // Ensure it has the /api/emails/webhook path if not already included
      if (!webhookUrl.includes('/api/emails/webhook')) {
        webhookUrl = webhookUrl.replace(/\/$/, '') + '/api/emails/webhook'
      }
    } else {
      // Fallback: Use production URL from NEXT_PUBLIC_APP_URL if it's a production URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL
      const isProductionUrl = appUrl && 
        !appUrl.includes('localhost') && 
        !appUrl.includes('127.0.0.1') && 
        (appUrl.startsWith('https://') || appUrl.startsWith('http://'))
      
      if (isProductionUrl) {
        const baseUrl = appUrl.replace(/\/$/, '')
        webhookUrl = `${baseUrl}/api/emails/webhook`
      } else {
        // Hardcoded production URL as final fallback
        // Change this to your actual production domain
        webhookUrl = 'https://successfamily.online/api/emails/webhook'
        console.warn('[Setup] Using hardcoded production webhook URL. Set INBOUND_WEBHOOK_URL for customization.')
      }
    }
    
    // Ensure webhook URL is HTTPS (webhooks must be secure)
    if (webhookUrl.startsWith('http://') && !webhookUrl.includes('localhost')) {
      webhookUrl = webhookUrl.replace(/^http:\/\//, 'https://')
      console.warn('[Setup] Upgraded webhook URL to HTTPS for security')
    }
    
    // Warn if somehow we ended up with localhost
    if (webhookUrl.includes('localhost') || webhookUrl.includes('127.0.0.1')) {
      console.error('[Setup] ❌ ERROR: Webhook URL cannot be localhost! Webhooks will not work.')
      console.error('[Setup] Please set INBOUND_WEBHOOK_URL to your production domain (e.g., https://successfamily.online/api/emails/webhook)')
      throw new Error('Webhook URL cannot be localhost. Set INBOUND_WEBHOOK_URL environment variable.')
    }
    
    console.log(`[Setup] Using webhook URL: ${webhookUrl} (always production, even in dev mode)`)
    console.log(`[Setup] Webhook URL source: ${process.env.INBOUND_WEBHOOK_URL ? 'INBOUND_WEBHOOK_URL' : process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost') ? 'NEXT_PUBLIC_APP_URL (production)' : 'hardcoded production URL'}`)

    // Create email address in Inbound
    let inboundAddressId: string | null = null
    let inboundEndpointId: string | null = null
    let inboundError: string | null = null

    try {
      const inboundResult = await createInboundEmailAddress(
        emailAddress,
        webhookUrl,
        user.id
      )
      inboundAddressId = inboundResult.addressId
      inboundEndpointId = inboundResult.endpointId
    } catch (error: any) {
      console.error("Error creating Inbound address:", error)
      inboundError = error.message
      // Continue to create the database record even if Inbound setup fails
    }

    // Create new email address record
    const { data: userEmail, error: insertError } = await supabase
      .from("user_emails")
      .insert({
        user_id: user.id,
        email_address: emailAddress,
        inbound_address_id: inboundAddressId,
        inbound_endpoint_id: inboundEndpointId,
        is_active: true,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to save email address", details: insertError.message },
        { status: 500 }
      )
    }

    // Return success with optional warning about Inbound setup
    if (inboundError) {
      return NextResponse.json({
        email: emailAddress,
        message: "Email address created (Inbound setup may need manual configuration)",
        warning: inboundError,
      })
    }

    return NextResponse.json({
      email: emailAddress,
      message: "Email address created successfully",
    })
  } catch (error: any) {
    console.error("Error in email setup:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}



