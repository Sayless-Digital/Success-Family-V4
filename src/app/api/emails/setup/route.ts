import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createInboundEmailAddress, updateInboundEndpoint } from "@/lib/inbound-email"

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

    // Get webhook URL (always use current environment URL)
    // In production, ensure we use HTTPS if the URL doesn't specify a protocol
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    
    // If baseUrl doesn't have a protocol and it's not localhost, assume HTTPS for production
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      // If it's localhost, use http, otherwise use https
      if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        baseUrl = `http://${baseUrl}`
      } else {
        baseUrl = `https://${baseUrl}`
      }
    }
    
    // Ensure production URLs use HTTPS (except localhost)
    if (process.env.NODE_ENV === 'production' && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
      baseUrl = baseUrl.replace(/^http:\/\//, 'https://')
    }
    
    const webhookUrl = `${baseUrl}/api/emails/webhook`

    // If email exists and Inbound is already configured, always update endpoint URL
    // This ensures the webhook URL matches the current environment (dev vs production)
    if (existingEmail && existingEmail.inbound_address_id && existingEmail.inbound_endpoint_id) {
      // Always update the endpoint URL to match current environment
      // This fixes cases where endpoints were created with localhost in dev but are now in production
      try {
        const updatedEndpoint = await updateInboundEndpoint(
          existingEmail.inbound_endpoint_id,
          webhookUrl,
          user.id
        )
        
        // Verify the update was successful
        const updatedUrl = (updatedEndpoint as any)?.config?.url
        if (updatedUrl && updatedUrl === webhookUrl) {
          console.log(`[Setup] Successfully updated endpoint URL for ${existingEmail.email_address} to ${webhookUrl}`)
          return NextResponse.json({
            email: existingEmail.email_address,
            message: "Email address updated with current webhook URL",
          })
        } else {
          console.warn(`[Setup] Endpoint update may have failed. Expected URL: ${webhookUrl}, Got: ${updatedUrl}`)
          return NextResponse.json({
            email: existingEmail.email_address,
            message: "Email address exists",
            warning: "Endpoint URL update may have failed. Please verify in Inbound dashboard.",
          })
        }
      } catch (updateError: any) {
        // If update fails, log the error details
        console.error(`[Setup] Failed to update endpoint URL:`, updateError)
        const errorMessage = updateError?.message || String(updateError)
        return NextResponse.json({
          email: existingEmail.email_address,
          message: "Email address already exists",
          warning: `Could not update webhook URL: ${errorMessage}. Please check your Inbound dashboard.`,
        })
      }
    }

    // Determine email address (use existing or generate new)
    let emailAddress: string
    if (existingEmail) {
      // Use existing email address for retry
      emailAddress = existingEmail.email_address
    } else {
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
      emailAddress = generatedEmail
    }

    // Create/retry email address in Inbound
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
      // Continue to update/create the database record even if Inbound setup fails
    }

    // Update existing record or create new one
    if (existingEmail) {
      // Update existing email with Inbound IDs
      const { data: userEmail, error: updateError } = await supabase
        .from("user_emails")
        .update({
          inbound_address_id: inboundAddressId,
          inbound_endpoint_id: inboundEndpointId,
        })
        .eq("id", existingEmail.id)
        .select()
        .single()

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to update email address", details: updateError.message },
          { status: 500 }
        )
      }

      // Return success with optional warning about Inbound setup
      if (inboundError) {
        return NextResponse.json({
          email: emailAddress,
          message: "Email address updated (Inbound setup may need manual configuration)",
          warning: inboundError,
        })
      }

      return NextResponse.json({
        email: emailAddress,
        message: "Email address synced with Inbound successfully",
      })
    } else {
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
    }
  } catch (error: any) {
    console.error("Error in email setup:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

