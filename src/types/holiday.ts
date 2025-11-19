export const HOLIDAY_MODES = ["none", "christmas"] as const

export type HolidayMode = (typeof HOLIDAY_MODES)[number]

export const DEFAULT_HOLIDAY_MODE: HolidayMode = "none"

