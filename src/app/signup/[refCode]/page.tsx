import { notFound, redirect } from "next/navigation"
import { createServerSupabaseClient, createPublicSupabaseClient } from "@/lib/supabase-server"
import { ReferralSignupView } from "./referral-signup-view"
import type { Metadata } from "next"

interface ReferralSignupPageProps {
  params: Promise<{ refCode: string }>
}

// Generate dynamic metadata for SEO
export async function generateMetadata(
  props: ReferralSignupPageProps
): Promise<Metadata> {
  const params = await props.params
  const refCode = params.refCode

  if (!refCode) {
    return {
      title: "Join Success Family",
      description: "Join Success Family and start your journey to success",
    }
  }

  // Use public client to fetch referrer info for SEO (no auth required)
  const supabase = createPublicSupabaseClient()
  const { data: referrerUser } = await supabase
    .from("users")
    .select("first_name, last_name, username")
    .eq("username", refCode)
    .maybeSingle()

  if (referrerUser) {
    const referrerName = `${referrerUser.first_name} ${referrerUser.last_name}`
    return {
      title: `Join Success Family - Invited by ${referrerName}`,
      description: `${referrerName} invited you to join Success Family. Create your account and start earning, connecting, and growing with our community.`,
      openGraph: {
        title: `Join Success Family - Invited by ${referrerName}`,
        description: `${referrerName} invited you to join Success Family. Create your account and start earning, connecting, and growing with our community.`,
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: `Join Success Family - Invited by ${referrerName}`,
        description: `${referrerName} invited you to join Success Family. Create your account and start earning, connecting, and growing with our community.`,
      },
    }
  }

  return {
    title: "Join Success Family",
    description: "Join Success Family and start your journey to success",
  }
}

export default async function ReferralSignupPage(props: ReferralSignupPageProps) {
  const params = await props.params
  const refCode = params.refCode

  if (!refCode) {
    notFound()
  }

  // Use public client first to check if referrer exists (no auth required)
  const publicSupabase = createPublicSupabaseClient()
  
  // Verify that the referral code (username) exists
  const { data: referrerUser, error } = await publicSupabase
    .from("users")
    .select("id, username, first_name, last_name, profile_picture")
    .eq("username", refCode)
    .maybeSingle()

  if (error || !referrerUser) {
    notFound()
  }

  // Check if user is already authenticated (only for authenticated users)
  // We use server client here to check auth status
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If user is authenticated, redirect to home (they don't need to sign up again)
  if (user) {
    redirect("/")
  }

  // Get referral settings
  const { data: settings } = await publicSupabase
    .from("platform_settings")
    .select("referral_bonus_points, referral_max_topups")
    .eq("id", 1)
    .single()

  return (
    <ReferralSignupView
      referrerUser={referrerUser}
      referralBonusPoints={settings?.referral_bonus_points || 20}
      referralMaxTopups={settings?.referral_max_topups || 3}
    />
  )
}
