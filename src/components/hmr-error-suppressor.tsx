"use client"

import { useEffect } from "react"

/**
 * HMR Error Suppressor
 * Suppresses Next.js HMR WebSocket connection errors in development.
 * These errors are expected when using a custom HTTPS server because:
 * 1. Custom servers don't support WebSocket upgrades properly
 * 2. Next.js automatically falls back to polling (which works perfectly)
 * 3. The errors are harmless but flood the console
 * 
 * This component filters console output to hide these known dev-only errors.
 */
export function HMRErrorSuppressor() {
  useEffect(() => {
    // Only run in development
    if (process.env.NODE_ENV !== 'development') return

    // Store original console methods
    const originalError = console.error
    const originalWarn = console.warn
    const originalLog = console.log

    // Pattern to match Next.js HMR WebSocket errors
    const hmrWebSocketPattern = /WebSocket connection to 'wss?:\/\/.*\/_next\/(webpack-hmr|static\/hmr)/i
    const hmrErrorPatterns = [
      hmrWebSocketPattern,
      /failed to connect to the development server/i,
      /webpack-hmr/i,
    ]

    // Helper to check if message should be suppressed
    const shouldSuppress = (args: unknown[]): boolean => {
      const message = args.join(' ')
      return hmrErrorPatterns.some(pattern => pattern.test(message))
    }

    // Override console methods to filter HMR errors
    console.error = (...args: unknown[]) => {
      if (!shouldSuppress(args)) {
        originalError.apply(console, args)
      }
    }

    console.warn = (...args: unknown[]) => {
      if (!shouldSuppress(args)) {
        originalWarn.apply(console, args)
      }
    }

    console.log = (...args: unknown[]) => {
      if (!shouldSuppress(args)) {
        originalLog.apply(console, args)
      }
    }

    // Log once that we're suppressing these errors
    originalLog(
      '%c[HMR] WebSocket errors suppressed (custom HTTPS server uses polling for HMR)',
      'color: #888; font-style: italic;'
    )

    // Cleanup: restore original console methods
    return () => {
      console.error = originalError
      console.warn = originalWarn
      console.log = originalLog
    }
  }, [])

  return null
}