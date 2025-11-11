import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { ReferralsView } from "./referrals-view"

export default async function ReferralsPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  // Get user profile
  const { data: userProfile } = await supabase
    .from("users")
    .select("id, username, first_name, last_name")
    .eq("id", user.id)
    .single()

  if (!userProfile) {
    redirect("/")
  }

  // Get referral settings
  const { data: settings } = await supabase
    .from("platform_settings")
    .select("referral_bonus_points, referral_max_topups")
    .eq("id", 1)
    .single()

  // Get user's referrals (people they referred)
  const { data: referralsData } = await supabase
    .from("referrals")
    .select(`
      id,
      referred_user_id,
      created_at,
      referred_user:users!referrals_referred_user_id_fkey(
        id,
        username,
        first_name,
        last_name,
        profile_picture,
        email
      )
    `)
    .eq("referrer_user_id", user.id)
    .order("created_at", { ascending: false })

  // Transform referrals data - extract single object from array
  const referrals = (referralsData || []).map((referral: any) => ({
    id: referral.id,
    referred_user_id: referral.referred_user_id,
    created_at: referral.created_at,
    referred_user: Array.isArray(referral.referred_user)
      ? referral.referred_user[0]
      : referral.referred_user,
  })).filter((referral) => referral.referred_user) // Filter out any with missing user data

  // Get referral topups (conversions)
  const referralIds = referrals.map((r) => r.id)
  let referralTopups: any[] = []
  
  if (referralIds.length > 0) {
    const { data } = await supabase
      .from("referral_topups")
      .select(`
        id,
        transaction_id,
        referrer_bonus_transaction_id,
        bonus_points_awarded,
        topup_number,
        created_at,
        referral:referrals!referral_topups_referral_id_fkey(
          referred_user:users!referrals_referred_user_id_fkey(
            id,
            username,
            first_name,
            last_name,
            profile_picture
          )
        ),
        transaction:transactions!referral_topups_transaction_id_fkey(
          id,
          amount_ttd,
          created_at
        )
      `)
      .in("referral_id", referralIds)
      .order("created_at", { ascending: false })
    
    // Transform referral topups data - extract single objects from arrays
    referralTopups = (data || []).map((topup: any) => {
      const referral = Array.isArray(topup.referral) ? topup.referral[0] : topup.referral
      const referredUser = referral?.referred_user
        ? (Array.isArray(referral.referred_user) ? referral.referred_user[0] : referral.referred_user)
        : null
      const transaction = Array.isArray(topup.transaction) ? topup.transaction[0] : topup.transaction

      return {
        id: topup.id,
        transaction_id: topup.transaction_id,
        referrer_bonus_transaction_id: topup.referrer_bonus_transaction_id,
        bonus_points_awarded: Number(topup.bonus_points_awarded || 0),
        topup_number: Number(topup.topup_number || 0),
        created_at: topup.created_at,
        referral: {
          referred_user: referredUser,
        },
        transaction: transaction,
      }
    }).filter((topup) => topup.referral.referred_user && topup.transaction)
  }

  // Calculate total earnings
  const totalEarnings =
    referralTopups.reduce(
      (sum, rt) => sum + Number(rt.bonus_points_awarded || 0),
      0
    ) || 0

  // Get referral bonus transactions for transaction history
  const { data: bonusTransactionsData } = await supabase
    .from("transactions")
    .select(`
      id,
      points_delta,
      created_at,
      recipient_user_id,
      recipient:users!transactions_recipient_user_id_fkey(
        id,
        username,
        first_name,
        last_name
      )
    `)
    .eq("user_id", user.id)
    .eq("type", "referral_bonus")
    .order("created_at", { ascending: false })
    .limit(50)

  // Transform bonus transactions data - extract single object from array
  const bonusTransactions = (bonusTransactionsData || []).map((transaction: any) => ({
    id: transaction.id,
    points_delta: Number(transaction.points_delta || 0),
    created_at: transaction.created_at,
    recipient_user_id: transaction.recipient_user_id,
    recipient: Array.isArray(transaction.recipient)
      ? transaction.recipient[0]
      : transaction.recipient,
  })).filter((transaction) => transaction.recipient) // Filter out any with missing recipient data

  return (
    <ReferralsView
      user={userProfile}
      referralBonusPoints={settings?.referral_bonus_points || 20}
      referralMaxTopups={settings?.referral_max_topups || 3}
      referrals={referrals}
      referralTopups={referralTopups}
      totalEarnings={totalEarnings}
      bonusTransactions={bonusTransactions}
    />
  )
}

