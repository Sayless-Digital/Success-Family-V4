"use client"

import * as React from "react"
import type { HolidayMode } from "@/types/holiday"
import { DEFAULT_HOLIDAY_MODE } from "@/types/holiday"

interface HolidayModeContextValue {
  mode: HolidayMode
}

const HolidayModeContext = React.createContext<HolidayModeContextValue>({
  mode: DEFAULT_HOLIDAY_MODE,
})

interface HolidayModeProviderProps {
  mode?: HolidayMode
  children: React.ReactNode
}

export function HolidayModeProvider({ mode = DEFAULT_HOLIDAY_MODE, children }: HolidayModeProviderProps) {
  return (
    <HolidayModeContext.Provider value={{ mode }}>
      {children}
    </HolidayModeContext.Provider>
  )
}

export function useHolidayMode(): HolidayMode {
  const context = React.useContext(HolidayModeContext)
  return context.mode
}

export function useIsChristmasMode(): boolean {
  return useHolidayMode() === "christmas"
}

