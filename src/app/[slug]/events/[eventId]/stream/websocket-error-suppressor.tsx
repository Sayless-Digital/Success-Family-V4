"use client"

import { useEffect } from "react"

/**
 * WebSocket Error Suppressor
 * Suppresses known WebSocket frame errors that occur in development
 * with Next.js and Stream.io
 */
export function WebSocketErrorSuppressor() {
  useEffect(() => {
    // Suppress uncaught WebSocket frame errors globally
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.error?.message || event.message || ''
      
      // Check if it's a WebSocket frame error
      if (
        errorMessage.includes('Invalid WebSocket frame') ||
        errorMessage.includes('WS_ERR_INVALID_CLOSE_CODE') ||
        errorMessage.includes('WS_ERR_INVALID_UTF8') ||
        errorMessage.includes('invalid status code')
      ) {
        console.log('[Stream] Suppressing WebSocket frame error (known dev issue)')
        event.preventDefault()
        event.stopPropagation()
        return false
      }
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const reasonStr = typeof reason === 'object' ? JSON.stringify(reason) : String(reason)
      
      // Check if it's a WebSocket frame error
      if (
        reasonStr.includes('Invalid WebSocket frame') ||
        reasonStr.includes('WS_ERR_INVALID_CLOSE_CODE') ||
        reasonStr.includes('WS_ERR_INVALID_UTF8') ||
        reasonStr.includes('invalid status code')
      ) {
        console.log('[Stream] Suppressing unhandled WebSocket rejection (known dev issue)')
        event.preventDefault()
        return false
      }
    }

    // Add global error handlers
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    // Cleanup
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return null
}