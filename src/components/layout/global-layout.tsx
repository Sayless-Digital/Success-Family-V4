import { ClientLayoutWrapper } from "./client-layout-wrapper"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import type { HolidayMode } from "@/types/holiday"
import { DEFAULT_HOLIDAY_MODE, HOLIDAY_MODES } from "@/types/holiday"

interface GlobalLayoutProps {
  children: React.ReactNode
}

/**
 * Server Component wrapper for layout
 * Client interactivity handled by ClientLayoutWrapper
 */
export async function GlobalLayout({ children }: GlobalLayoutProps) {
  let holidayMode: HolidayMode = DEFAULT_HOLIDAY_MODE

  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from("platform_settings")
      .select("holiday_mode")
      .eq("id", 1)
      .maybeSingle<{ holiday_mode?: string }>()

    if (!error && data?.holiday_mode && HOLIDAY_MODES.includes(data.holiday_mode as HolidayMode)) {
      holidayMode = data.holiday_mode as HolidayMode
    }
  } catch (error) {
    console.error("[GlobalLayout] Failed to load holiday mode:", error)
  }

  return <ClientLayoutWrapper holidayMode={holidayMode}>{children}</ClientLayoutWrapper>
}
