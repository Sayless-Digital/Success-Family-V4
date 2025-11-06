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
    const originalWindowError = window.onerror

    // Patterns to match Next.js HMR WebSocket errors
    // These errors occur because custom HTTPS servers don't support WebSocket upgrades
    // Next.js automatically falls back to polling, which works fine
    const hmrErrorPatterns = [
      /WebSocket connection to 'wss?:\/\/.*\/_next\/(webpack-hmr|static\/hmr)/i,
      /WebSocket connection to.*webpack-hmr/i,
      /WebSocket connection to.*_next\/webpack-hmr/i,
      /failed to connect to the development server/i,
      /webpack-hmr/i,
      /_next\/webpack-hmr/i,
      /wss?:\/\/.*:3000\/_next\/webpack-hmr/i,
    ]

    // Helper to check if message should be suppressed
    const shouldSuppress = (args: unknown[]): boolean => {
      // Convert all arguments to string and join
      const message = args.map(arg => {
        if (typeof arg === 'string') return arg
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg)
          } catch {
            return String(arg)
          }
        }
        return String(arg)
      }).join(' ')
      
      // Check if any pattern matches
      return hmrErrorPatterns.some(pattern => pattern.test(message))
    }

    // Override console methods to filter HMR errors
    console.error = (...args: unknown[]) => {
      if (!shouldSuppress(args)) {
        originalError.apply(console, args)
      }
      // Silently suppress HMR errors
    }

    console.warn = (...args: unknown[]) => {
      if (!shouldSuppress(args)) {
        originalWarn.apply(console, args)
      }
      // Silently suppress HMR warnings
    }

    console.log = (...args: unknown[]) => {
      if (!shouldSuppress(args)) {
        originalLog.apply(console, args)
      }
      // Silently suppress HMR logs
    }
    
    // Also suppress uncaught errors from WebSocket initialization
    // This catches errors that occur before React hydration
    window.onerror = (message, source, lineno, colno, error) => {
      const messageStr = String(message)
      if (hmrErrorPatterns.some(pattern => pattern.test(messageStr))) {
        // Suppress HMR WebSocket errors
        return true // Prevent default error handling
      }
      // Call original handler for other errors
      if (originalWindowError) {
        return originalWindowError(message, source, lineno, colno, error)
      }
      return false
    }

    // Log once that we're suppressing these errors
    originalLog(
      '%c[HMR] WebSocket errors suppressed (custom HTTPS server uses polling for HMR)',
      'color: #888; font-style: italic;'
    )

    // Cleanup: restore original console methods and window error handler
    return () => {
      console.error = originalError
      console.warn = originalWarn
      console.log = originalLog
      window.onerror = originalWindowError
    }
  }, [])

  return null
}