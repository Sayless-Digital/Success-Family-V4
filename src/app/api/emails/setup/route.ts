import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { setupPersonalizedEmail, getSetupInstructions } from "@/lib/resend-email"

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

    // With Resend, we don't create individual addresses via API
    // We just validate the email and store it in the database
    // The wildcard domain route in Resend will catch all emails
    console.log(`[Setup] Validating email address: ${emailAddress}`)
    
    const setupResult = await setupPersonalizedEmail(emailAddress)
    
    if (!setupResult.success) {
      return NextResponse.json(
        { error: setupResult.error || "Failed to validate email address" },
        { status: 400 }
      )
    }

    // Create new email address record
    const { data: userEmail, error: insertError } = await supabase
      .from("user_emails")
      .insert({
        user_id: user.id,
        email_address: emailAddress,
        inbound_address_id: null, // Not used with Resend
        inbound_endpoint_id: null, // Not used with Resend
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

    // Return success with setup instructions
    return NextResponse.json({
      email: emailAddress,
      message: "Email address created successfully",
      setupInstructions: getSetupInstructions(),
      note: "Make sure wildcard domain routing is configured in Resend dashboard"
    })
  } catch (error: any) {
    console.error("Error in email setup:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}



