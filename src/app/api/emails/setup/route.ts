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

    if (existingEmail) {
      return NextResponse.json({
        email: existingEmail.email_address,
        message: "Email address already exists",
      })
    }

    // Generate personalized email address
    const { data: emailAddress, error: emailError } = await supabase.rpc(
      "generate_personalized_email",
      {
        first_name: userProfile.first_name,
        last_name: userProfile.last_name,
      }
    )

    if (emailError || !emailAddress) {
      return NextResponse.json(
        { error: "Failed to generate email address" },
        { status: 500 }
      )
    }

    // Get webhook URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const webhookUrl = `${baseUrl}/api/emails/webhook`

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
      // The user can set up Inbound manually later
    }

    // Store email address in database
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

