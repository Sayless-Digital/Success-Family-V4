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

    // Initialize push notifications (non-blocking)
    // This will:
    // 1. Request notification permission
    // 2. Register service worker
    // 3. Subscribe to push notifications
    // 4. Save subscription to database
    subscribeToPushNotifications(user.id).catch((error) => {
      console.error('[push-notifications-provider] Error initializing push notifications:', error)
      // Non-critical error - app continues to work without push notifications
    })
  }, [user?.id])

  return <>{children}</>
}


