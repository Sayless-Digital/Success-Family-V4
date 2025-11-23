import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const { firstName, lastName, countryCode, whatsappNumber } = body

    // Validation
    if (!firstName || typeof firstName !== "string" || firstName.trim().length === 0) {
      return NextResponse.json(
        { error: "First name is required" },
        { status: 400 }
      )
    }

    if (!lastName || typeof lastName !== "string" || lastName.trim().length === 0) {
      return NextResponse.json(
        { error: "Last name is required" },
        { status: 400 }
      )
    }

    // Default to +1 if country code is not provided
    const finalCountryCode = countryCode && typeof countryCode === "string" ? countryCode : "+1"

    if (!whatsappNumber || typeof whatsappNumber !== "string" || whatsappNumber.trim().length === 0) {
      return NextResponse.json(
        { error: "WhatsApp number is required" },
        { status: 400 }
      )
    }

    // Validate phone number format (digits only, reasonable length)
    const phoneRegex = /^\d{7,15}$/
    if (!phoneRegex.test(whatsappNumber.trim())) {
      return NextResponse.json(
        { error: "Invalid phone number format" },
        { status: 400 }
      )
    }

    // Insert signup
    const { data, error } = await supabase
      .from("webinar_signups")
      .insert({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        country_code: finalCountryCode,
        whatsapp_number: whatsappNumber.trim(),
      })
      .select()
      .single()

    if (error) {
      console.error("[Webinar Signup API] Database insert failed:", error)
      return NextResponse.json(
        { error: "Failed to save signup. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        signup: data,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("[Webinar Signup API] Unexpected error:", error)
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred" },
      { status: 500 }
    )
  }
}

