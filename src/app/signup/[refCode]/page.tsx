import { notFound, redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { ReferralSignupView } from "./referral-signup-view"

interface ReferralSignupPageProps {
  params: Promise<{ refCode: string }>
}

export default async function ReferralSignupPage(props: ReferralSignupPageProps) {
  const params = await props.params
  const refCode = params.refCode

  if (!refCode) {
    notFound()
  }

  const supabase = await createServerSupabaseClient()

  // Check if user is already authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/")
  }

  // Verify that the referral code (username) exists
  const { data: referrerUser, error } = await supabase
    .from("users")
    .select("id, username, first_name, last_name, profile_picture")
    .eq("username", refCode)
    .maybeSingle()

  if (error || !referrerUser) {
    notFound()
  }

  // Get referral settings
  const { data: settings } = await supabase
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
