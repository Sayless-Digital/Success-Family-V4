"use server"

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { env } from '@/lib/env'
import webpush from 'web-push'

// Configure web-push with VAPID keys
if (env.VAPID_PRIVATE_KEY && env.VAPID_EMAIL) {
  webpush.setVapidDetails(
    `mailto:${env.VAPID_EMAIL}`,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY
  )
}

export interface SendPushNotificationResult {
  success: boolean
  sent?: number
  total?: number
  message?: string
  error?: string
}

/**
 * Send push notification for a given notification ID
 * This function can be called directly from server actions/API routes
 */
export async function sendPushNotification(
  notificationId: string
): Promise<SendPushNotificationResult> {
  try {
    if (!notificationId) {
      console.error('[push-notifications] ❌ Missing notificationId')
      return { success: false, error: 'Missing notificationId' }
    }

    console.log('[push-notifications] Sending push notification for:', notificationId)

    // Check if VAPID keys are configured
    if (!env.VAPID_PRIVATE_KEY || !env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      console.warn('[push-notifications] ⚠️ VAPID keys not configured, skipping push notification')
      return { success: false, message: 'VAPID keys not configured' }
    }

    const supabase = await createServerSupabaseClient()

    // Get notification using RPC function that bypasses RLS
    // This is necessary because the server needs to read notifications for any user
    // to send push notifications, but RLS only allows users to read their own notifications
    const { data: notifications, error: notificationError } = await supabase
      .rpc('get_notification_for_push', { p_notification_id: notificationId })

    if (notificationError || !notifications || notifications.length === 0) {
      console.error('[push-notifications] ❌ Error fetching notification:', notificationError)
      return { success: false, error: 'Notification not found' }
    }

    const notification = notifications[0]

    console.log('[push-notifications] Notification found:', {
      id: notification.id,
      userId: notification.user_id,
      title: notification.title,
      isRead: notification.is_read
    })

    // Don't send push if notification is already read
    if (notification.is_read) {
      console.log('[push-notifications] ⚠️ Notification already read, skipping push')
      return { success: false, message: 'Notification already read' }
    }

    // Get user's push subscriptions using RPC function that bypasses RLS
    // This is necessary because the server needs to read subscriptions for any user
    // to send push notifications, but RLS only allows users to read their own subscriptions
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .rpc('get_push_subscriptions_for_push', { p_user_id: notification.user_id })

    if (subscriptionsError) {
      console.error('[push-notifications] ❌ Error fetching subscriptions:', subscriptionsError)
      return { success: false, error: 'Failed to fetch subscriptions' }
    }

    console.log('[push-notifications] Found subscriptions:', subscriptions?.length || 0)
    console.log('[push-notifications] User ID:', notification.user_id)

    if (!subscriptions || subscriptions.length === 0) {
      // No subscriptions - that's okay, user hasn't enabled push notifications
      console.log('[push-notifications] ⚠️ No push subscriptions found for user:', notification.user_id)
      console.log('[push-notifications] ⚠️ User needs to grant notification permission and subscribe to push notifications')
      console.log('[push-notifications] ⚠️ Notification will only appear in-app, not as a browser push notification')
      return { success: false, message: 'No push subscriptions found' }
    }

    // Prepare push payload
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      action_url: notification.action_url || '/',
      id: notification.id,
      type: notification.type
    })

    // Send push to all user's devices
    console.log('[push-notifications] Sending push notifications to', subscriptions.length, 'devices...')
    const sendPromises = subscriptions.map(async (sub: {
      id: string
      user_id: string
      endpoint: string
      p256dh_key: string
      auth_key: string
      user_agent: string | null
      created_at: string
      updated_at: string
    }) => {
      try {
        console.log('[push-notifications] Sending to subscription:', sub.id, sub.endpoint.substring(0, 50) + '...')
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh_key,
              auth: sub.auth_key
            }
          },
          payload
        )
        console.log('[push-notifications] ✅ Push sent successfully to subscription:', sub.id)
        return { success: true, subscriptionId: sub.id }
      } catch (error: any) {
        console.error('[push-notifications] ❌ Push notification failed for subscription:', sub.id, error)
        console.error('[push-notifications] Error details:', {
          statusCode: error.statusCode,
          statusText: error.statusText,
          message: error.message
        })

        // If subscription is invalid (410 Gone, 404 Not Found), remove it
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log('[push-notifications] Removing invalid subscription:', sub.id)
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id)
        }

        return { success: false, subscriptionId: sub.id, error }
      }
    })

    const results = await Promise.allSettled(sendPromises)

    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length

    console.log('[push-notifications] Push notification results:', {
      sent: successCount,
      total: subscriptions.length,
      failed: subscriptions.length - successCount
    })

    return {
      success: true,
      sent: successCount,
      total: subscriptions.length
    }
  } catch (error: any) {
    console.error('[push-notifications] Error sending push notification:', error)
    return { success: false, error: error.message || 'Internal server error' }
  }
}

