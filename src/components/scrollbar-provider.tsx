"use client"

import { ReactNode } from 'react'

interface ScrollbarProviderProps {
  children: ReactNode
}

/**
 * Lightweight scrollbar provider using native CSS
 * Removed OverlayScrollbars for better performance
 */
export function ScrollbarProvider({ children }: ScrollbarProviderProps) {
  return (
    <div className="h-screen w-full overflow-hidden">
      {children}
    </div>
  )
}

