import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { env } from "@/lib/env"
import { emailTemplates, sendEmail } from "@/lib/email"

const CRON_HEADER = "x-cron-secret"
const MS_PER_DAY = 86_400_000

const startOfDay = (date: Date) => {
  const copy = new Date(date)
  copy.setUTCHours(0, 0, 0, 0)
  return copy
}

const daysBetween = (later: Date, earlier: Date) =>
  Math.floor((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / MS_PER_DAY)

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

  if (!env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY is required to send reminders" }, { status: 500 })
  }

  const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const today = startOfDay(new Date())
  const todayISO = today.toISOString().slice(0, 10)

  const { data: settings, error: settingsError } = await adminClient
    .from("platform_settings")
    .select("mandatory_topup_ttd")
    .eq("id", 1)
    .maybeSingle()

  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 })
  }

  const mandatoryTopupAmount = Number(settings?.mandatory_topup_ttd ?? 0)
  if (!Number.isFinite(mandatoryTopupAmount) || mandatoryTopupAmount <= 0) {
    return NextResponse.json({ error: "Invalid mandatory_topup_ttd in platform settings" }, { status: 500 })
  }

  const { data: wallets, error: walletsError } = await adminClient
    .from("wallets")
    .select("user_id, next_topup_due_on, last_topup_reminder_at, user:users(email, first_name, last_name, username)")
    .not("next_topup_due_on", "is", null)

  if (walletsError) {
    return NextResponse.json({ error: walletsError.message }, { status: 500 })
  }

  const results: {
    userId: string
    status: "sent" | "skipped" | "error"
    reason?: string
  }[] = []

  for (const wallet of wallets ?? []) {
    const dueDateStr: string | null = wallet.next_topup_due_on
    if (!dueDateStr) {
      results.push({ userId: wallet.user_id, status: "skipped", reason: "no_due_date" })
      continue
    }

    const dueDate = startOfDay(new Date(dueDateStr))
    const deltaDays = daysBetween(dueDate, today) // positive when due in future, negative when overdue
    const isDueToday = deltaDays === 0
    const isOverdue = deltaDays < 0

    const lastReminderAt = wallet.last_topup_reminder_at ? new Date(wallet.last_topup_reminder_at) : null
    const daysSinceReminder = lastReminderAt ? daysBetween(today, lastReminderAt) : Infinity

    let shouldSend = false
    let overdueDays = 0

    if (isDueToday) {
      shouldSend = daysSinceReminder >= 1
    } else if (isOverdue) {
      overdueDays = Math.abs(deltaDays)
      shouldSend = daysSinceReminder >= 7
    } else if (deltaDays === 3 && daysSinceReminder >= 1) {
      // Send one reminder three days before the due date
      shouldSend = true
    }

    if (!shouldSend) {
      results.push({ userId: wallet.user_id, status: "skipped", reason: "no_reminder_needed" })
      continue
    }

    const user = wallet.user as { email?: string; first_name?: string | null; last_name?: string | null; username?: string | null } | null
    const email = user?.email
    if (!email) {
      results.push({ userId: wallet.user_id, status: "skipped", reason: "missing_email" })
      continue
    }

    const displayName =
      (user?.first_name && user?.last_name && `${user.first_name} ${user.last_name}`) ||
      user?.username ||
      "there"

    try {
      const template = emailTemplates.walletTopupReminder(displayName, mandatoryTopupAmount, dueDateStr, overdueDays)
      await sendEmail({
        to: email,
        subject: template.subject,
        html: template.html,
      })

      await adminClient
        .from("wallets")
        .update({ last_topup_reminder_at: new Date().toISOString() })
        .eq("user_id", wallet.user_id)

      results.push({ userId: wallet.user_id, status: "sent" })
    } catch (error: any) {
      results.push({ userId: wallet.user_id, status: "error", reason: error?.message ?? "send_failed" })
    }
  }

  const summary = results.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return NextResponse.json({ summary, results, processed: wallets?.length ?? 0, date: todayISO })
}

