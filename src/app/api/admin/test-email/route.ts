import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { sendEmail, emailTemplates } from "@/lib/email"

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: userProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (userProfile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { template, recipientEmail, templateParams } = body

    if (!template || !recipientEmail) {
      return NextResponse.json(
        { error: "Template and recipient email are required" },
        { status: 400 }
      )
    }

    // Get the template function
    let emailData: { subject: string; html: string }
    
    try {
      switch (template) {
        case "welcome":
          emailData = emailTemplates.welcome(templateParams?.name || "Test User")
          break
        case "passwordReset":
          emailData = emailTemplates.passwordReset(
            templateParams?.resetLink || "https://example.com/reset?token=test"
          )
          break
        case "platformSubscriptionRequest":
          emailData = emailTemplates.platformSubscriptionRequest(
            templateParams?.userName || "Test User",
            templateParams?.communityName || "Test Community",
            templateParams?.amount || 99.99,
            templateParams?.billingCycle || "monthly"
          )
          break
        case "platformPaymentVerified":
          emailData = emailTemplates.platformPaymentVerified(
            templateParams?.userName || "Test User",
            templateParams?.communityName || "Test Community",
            templateParams?.amount || 99.99
          )
          break
        case "platformPaymentRejected":
          emailData = emailTemplates.platformPaymentRejected(
            templateParams?.userName || "Test User",
            templateParams?.communityName || "Test Community",
            templateParams?.reason || "Payment receipt unclear"
          )
          break
        case "platformInvoiceGenerated":
          emailData = emailTemplates.platformInvoiceGenerated(
            templateParams?.userName || "Test User",
            templateParams?.communityName || "Test Community",
            templateParams?.amount || 99.99,
            templateParams?.dueDate || new Date().toISOString()
          )
          break
        case "platformPaymentReminder":
          emailData = emailTemplates.platformPaymentReminder(
            templateParams?.userName || "Test User",
            templateParams?.communityName || "Test Community",
            templateParams?.amount || 99.99,
            templateParams?.daysUntilDue || 3,
            templateParams?.dueDate || new Date().toISOString()
          )
          break
        case "walletTopupReminder":
          emailData = emailTemplates.walletTopupReminder(
            templateParams?.userName || "Test User",
            templateParams?.amount || 50.0,
            templateParams?.dueDate || new Date().toISOString(),
            templateParams?.overdueDays || 0
          )
          break
        case "communitySubscriptionRequest":
          const communityRequest = emailTemplates.communitySubscriptionRequest(
            templateParams?.userName || "Test User",
            templateParams?.communityName || "Test Community",
            templateParams?.ownerName || "Community Owner",
            templateParams?.amount || 29.99,
            templateParams?.billingCycle || "monthly"
          )
          emailData = {
            subject: communityRequest.subject,
            html: communityRequest.html,
          }
          break
        case "communityPaymentVerified":
          const communityVerified = emailTemplates.communityPaymentVerified(
            templateParams?.userName || "Test User",
            templateParams?.communityName || "Test Community",
            templateParams?.ownerName || "Community Owner"
          )
          emailData = {
            subject: communityVerified.subject,
            html: communityVerified.html,
          }
          break
        case "communityPaymentRejected":
          emailData = emailTemplates.communityPaymentRejected(
            templateParams?.userName || "Test User",
            templateParams?.communityName || "Test Community",
            templateParams?.reason || "Payment receipt unclear"
          )
          break
        case "communityInvoiceGenerated":
          emailData = emailTemplates.communityInvoiceGenerated(
            templateParams?.userName || "Test User",
            templateParams?.communityName || "Test Community",
            templateParams?.amount || 29.99,
            templateParams?.dueDate || new Date().toISOString()
          )
          break
        case "communityPaymentReminder":
          emailData = emailTemplates.communityPaymentReminder(
            templateParams?.userName || "Test User",
            templateParams?.communityName || "Test Community",
            templateParams?.amount || 29.99,
            templateParams?.daysUntilDue || 3,
            templateParams?.dueDate || new Date().toISOString()
          )
          break
        default:
          return NextResponse.json(
            { error: `Unknown template: ${template}` },
            { status: 400 }
          )
      }

      // Send the email
      await sendEmail({
        to: recipientEmail,
        subject: emailData.subject,
        html: emailData.html,
      })

      return NextResponse.json({
        success: true,
        message: `Test email sent successfully to ${recipientEmail}`,
      })
    } catch (emailError: any) {
      return NextResponse.json(
        {
          error: "Failed to send email",
          details: emailError.message,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Error in test email endpoint:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

