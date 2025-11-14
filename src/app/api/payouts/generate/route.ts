import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { env } from "@/lib/env"

const CRON_HEADER = "x-cron-secret"

export async function POST(request: Request) {
  const configuredSecret = env.CRON_SECRET
  if (!configuredSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }

  const providedSecret =
    request.headers.get(CRON_HEADER) ||
    request.headers.get("authorization")?.replace("Bearer ", "")

  if (providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is required" }, { status: 500 })
  }

  const today = new Date()
  if (today.getUTCDate() !== 1) {
    return NextResponse.json({ error: "Payout generation only allowed on the 1st" }, { status: 409 })
  }

  const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: settings, error: settingsError } = await adminClient
    .from("platform_settings")
    .select("payout_minimum_ttd, user_value_per_point")
    .eq("id", 1)
    .maybeSingle()

  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 })
  }

  const userValue = Number(settings?.user_value_per_point ?? 0)
  const payoutMinimumTtd = Number(settings?.payout_minimum_ttd ?? 0)

  if (!Number.isFinite(userValue) || userValue <= 0) {
    return NextResponse.json({ error: "Invalid user_value_per_point in platform settings" }, { status: 500 })
  }

  if (!Number.isFinite(payoutMinimumTtd) || payoutMinimumTtd <= 0) {
    return NextResponse.json({ error: "Invalid payout_minimum_ttd in platform settings" }, { status: 500 })
  }

  const minimumPoints = Math.ceil(payoutMinimumTtd / userValue)
  const scheduledFor = today.toISOString().slice(0, 10) // YYYY-MM-DD

  const { data: wallets, error: walletsError } = await adminClient
    .from("wallets")
    .select("user_id, earnings_points")
    .gte("earnings_points", minimumPoints)

  if (walletsError) {
    return NextResponse.json({ error: walletsError.message }, { status: 500 })
  }

  const results: { userId: string; payoutId?: string; status: "created" | "skipped" | "error"; reason?: string }[] = []

  for (const wallet of wallets ?? []) {
    const userId = wallet.user_id
    try {
      // Ensure matured earnings are released
      await adminClient.rpc("process_matured_earnings", { p_user_id: userId, p_limit: 500 })

      // Re-fetch current earnings
      const { data: refreshedWallet, error: refreshedError } = await adminClient
        .from("wallets")
        .select("earnings_points")
        .eq("user_id", userId)
        .maybeSingle()

      if (refreshedError) {
        results.push({ userId, status: "error", reason: refreshedError.message })
        continue
      }

      const availablePoints = Math.trunc(Number(refreshedWallet?.earnings_points ?? 0))
      if (availablePoints < minimumPoints) {
        results.push({ userId, status: "skipped", reason: "insufficient_points_after_release" })
        continue
      }

      // Avoid duplicate payouts for the same date
      const { data: existingPayout } = await adminClient
        .from("payouts")
        .select("id")
        .eq("user_id", userId)
        .eq("scheduled_for", scheduledFor)
        .neq("status", "cancelled")
        .maybeSingle()

      if (existingPayout?.id) {
        results.push({ userId, status: "skipped", reason: "existing_payout" })
        continue
      }

      const amountTtd = Number((availablePoints * userValue).toFixed(2))
      const notes = `Automated payout generated on ${scheduledFor}`

      const { data: payoutId, error: lockError } = await adminClient.rpc("lock_earnings_for_payout", {
        p_user_id: userId,
        p_points: availablePoints,
        p_amount_ttd: amountTtd,
        p_scheduled_for: scheduledFor,
        p_notes: notes,
      })

      if (lockError) {
        results.push({ userId, status: "error", reason: lockError.message })
        continue
      }

      results.push({ userId, payoutId: payoutId as string, status: "created" })
    } catch (err: any) {
      results.push({ userId, status: "error", reason: err?.message ?? "unknown_error" })
    }
  }

  const summary = results.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return NextResponse.json({ summary, results })
}












