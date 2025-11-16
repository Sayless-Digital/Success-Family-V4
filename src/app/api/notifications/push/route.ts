import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(request: NextRequest) {
  try {
    const { notificationId } = await request.json()

    if (!notificationId) {
      return NextResponse.json(
        { error: 'Missing notificationId' },
        { status: 400 }
      )
    }

    // Check if VAPID keys are configured
    if (!env.VAPID_PRIVATE_KEY || !env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      console.warn('[push-notifications] VAPID keys not configured, skipping push notification')
      return NextResponse.json({ success: false, message: 'VAPID keys not configured' })
    }

    const supabase = await createServerSupabaseClient()

    // Get notification
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .single()

    if (notificationError || !notification) {
      console.error('[push-notifications] Error fetching notification:', notificationError)
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      )
    }

    // Don't send push if notification is already read
    if (notification.is_read) {
      return NextResponse.json({ success: false, message: 'Notification already read' })
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', notification.user_id)

    if (subscriptionsError) {
      console.error('[push-notifications] Error fetching subscriptions:', subscriptionsError)
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions' },
        { status: 500 }
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      // No subscriptions - that's okay, user hasn't enabled push notifications
      return NextResponse.json({ success: false, message: 'No push subscriptions found' })
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
    const sendPromises = subscriptions.map(async (sub) => {
      try {
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
        return { success: true, subscriptionId: sub.id }
      } catch (error: any) {
        console.error('[push-notifications] Push notification failed:', error)

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

    return NextResponse.json({
      success: true,
      sent: successCount,
      total: subscriptions.length
    })
  } catch (error: any) {
    console.error('[push-notifications] Error sending push notification:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

