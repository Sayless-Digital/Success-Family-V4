"use client"

import { useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'
import { subscribeToPushNotifications } from '@/lib/push-notifications'

/**
 * Provider component that initializes push notifications when user is logged in
 */
export function PushNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) {
      return
    }

    // Small delay to ensure page is fully loaded
    const timer = setTimeout(() => {
      // Initialize push notifications (non-blocking)
      // This will:
      // 1. Request notification permission
      // 2. Register service worker
      // 3. Subscribe to push notifications
      // 4. Save subscription to database
      subscribeToPushNotifications(user.id)
        .then((result) => {
          if (result) {
            console.log('[push-notifications-provider] ✅ Push notifications initialized successfully')
          } else {
            console.warn('[push-notifications-provider] ⚠️ Push notifications not available (permission denied or not supported)')
          }
        })
        .catch((error) => {
          console.error('[push-notifications-provider] ❌ Error initializing push notifications:', error)
          // Non-critical error - app continues to work without push notifications
        })
    }, 1000) // Wait 1 second after page load

    return () => clearTimeout(timer)
  }, [user?.id])

  return <>{children}</>
}


