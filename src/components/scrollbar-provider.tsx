"use client"

import { ReactNode } from 'react'

interface ScrollbarProviderProps {
  children: ReactNode
}

/**
 * Lightweight scrollbar provider using native CSS
 * Safe-area-inset handling moved to ClientLayoutWrapper to prevent hydration mismatches
 */
export function ScrollbarProvider({ children }: ScrollbarProviderProps) {
  return <>{children}</>
}
