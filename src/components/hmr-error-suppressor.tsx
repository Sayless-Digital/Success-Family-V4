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
 * This component:
 * 1. Intercepts WebSocket creation to prevent HMR WebSocket failures
 * 2. Filters console output to hide these known dev-only errors
 * 3. Prevents page refreshes when HMR WebSocket fails
 */
export function HMRErrorSuppressor() {
  useEffect(() => {
    // Only run in development
    if (process.env.NODE_ENV !== 'development') return

    // Store original WebSocket constructor
    const OriginalWebSocket = window.WebSocket
    
    // Intercept WebSocket creation to prevent HMR WebSocket failures from causing page refreshes
    // Create a mock WebSocket for HMR connections that never actually connects
    window.WebSocket = function(this: WebSocket, url: string | URL, protocols?: string | string[]) {
      const urlStr = typeof url === 'string' ? url : url.toString()
      
      // Check if this is an HMR WebSocket connection
      const isHMRConnection = urlStr.includes('/_next/webpack-hmr') || 
                             urlStr.includes('/_next/static/hmr') ||
                             urlStr.includes('webpack-hmr')
      
      if (isHMRConnection) {
        // For HMR connections, create a WebSocket but immediately suppress errors
        // This prevents Next.js from trying to use WebSocket and forces it to use polling
        const ws = new OriginalWebSocket(url, protocols)
        
        // Suppress all errors and events from this WebSocket
        const suppressEvent = (e: Event) => {
          e.stopPropagation()
          e.preventDefault()
          e.stopImmediatePropagation()
        }
        
        ws.addEventListener('error', suppressEvent, { capture: true })
        ws.addEventListener('open', suppressEvent, { capture: true })
        ws.addEventListener('close', suppressEvent, { capture: true })
        ws.addEventListener('message', suppressEvent, { capture: true })
        
        // Try to close immediately
        try {
          if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
            ws.close(1000, 'HMR WebSocket disabled - using polling instead')
          }
        } catch (e) {
          // Ignore errors during close
        }
        
        // Override methods to prevent HMR WebSocket from doing anything
        const originalSend = ws.send.bind(ws)
        const originalClose = ws.close.bind(ws)
        
        ws.send = function() {
          // Silently ignore send attempts on HMR WebSocket
          return
        }
        
        ws.close = function() {
          // Already closed, do nothing
          return
        }
        
        return ws
      }
      
      // For non-HMR connections, use the original WebSocket
      return new OriginalWebSocket(url, protocols)
    } as any
    
    // Copy static properties from original WebSocket
    Object.setPrototypeOf(window.WebSocket, OriginalWebSocket)
    Object.setPrototypeOf(window.WebSocket.prototype, OriginalWebSocket.prototype)

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
        // Suppress HMR WebSocket errors and prevent page refresh
        return true // Prevent default error handling (page refresh)
      }
      // Call original handler for other errors
      if (originalWindowError) {
        return originalWindowError(message, source, lineno, colno, error)
      }
      return false
    }
    
    // Also handle unhandled promise rejections from HMR WebSocket
    const originalUnhandledRejection = window.onunhandledrejection
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const reasonStr = typeof reason === 'object' ? JSON.stringify(reason) : String(reason)
      
      // Check if it's an HMR WebSocket error
      if (hmrErrorPatterns.some(pattern => pattern.test(reasonStr))) {
        // Suppress HMR WebSocket promise rejections and prevent page refresh
        event.preventDefault()
        return
      }
      
      // Call original handler for other rejections
      if (originalUnhandledRejection) {
        originalUnhandledRejection.call(window, event)
      }
    }
    window.onunhandledrejection = handleUnhandledRejection

    // Log once that we're suppressing these errors
    originalLog(
      '%c[HMR] WebSocket errors suppressed (custom HTTPS server uses polling for HMR)',
      'color: #888; font-style: italic;'
    )

    // Cleanup: restore original console methods, window error handler, unhandled rejection handler, and WebSocket
    return () => {
      console.error = originalError
      console.warn = originalWarn
      console.log = originalLog
      window.onerror = originalWindowError
      window.onunhandledrejection = originalUnhandledRejection
      window.WebSocket = OriginalWebSocket
    }
  }, [])

  return null
}