import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { env } from "@/lib/env"
import { AdminPayoutsClient } from "./payouts-client"

async function ensureMonthlyPayouts() {
  if (!env.CRON_SECRET || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[Payout Cron] Missing CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY; skipping automatic payout generation.")
    return
  }

  const today = new Date()
  if (today.getUTCDate() !== 1) {
    return
  }

  const headersList = await headers()
  const host = headersList.get("host")
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http"
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (host ? `${protocol}://${host}` : null)

  if (!baseUrl) {
    console.warn("[Payout Cron] Unable to resolve base URL; skipping payout generation.")
    return
  }

  const res = await fetch(`${baseUrl}/api/payouts/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": env.CRON_SECRET,
    },
    cache: "no-store",
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    const body = await res.text()
    console.error("[Payout Cron] Failed to generate payouts:", res.status, body)
  }
}

export default async function AdminPayoutsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/admin")
  }

  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (me?.role !== "admin") {
    redirect("/")
  }

  await ensureMonthlyPayouts()

  return <AdminPayoutsClient />
}

