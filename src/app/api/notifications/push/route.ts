import { NextRequest, NextResponse } from 'next/server'
import { sendPushNotification } from '@/lib/push-notifications-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { notificationId, notificationData } = body

    // Support both old format (notificationId) and new format (notificationData)
    if (!notificationId && !notificationData) {
      console.error('[push-notifications] ❌ Missing notificationId or notificationData in request')
      return NextResponse.json(
        { error: 'Missing notificationId or notificationData' },
        { status: 400 }
      )
    }

    console.log('[push-notifications] Received push notification request:', {
      notificationId,
      hasNotificationData: !!notificationData
    })

    // Call the shared push notification function
    // If notificationData is provided, use it directly (avoids race conditions)
    // Otherwise fall back to fetching by notificationId (backward compatibility)
    const result = notificationData 
      ? await sendPushNotification(notificationData)
      : await sendPushNotification(notificationId)

    if (result.success) {
      return NextResponse.json({
        success: true,
        sent: result.sent,
        total: result.total
      })
    } else {
      // Map error messages to appropriate status codes
      let status = 500
      if (result.error === 'Missing notificationId') {
        status = 400
      } else if (result.error === 'Notification not found') {
        status = 404
      } else if (result.message === 'VAPID keys not configured') {
        status = 500
      } else if (result.message === 'No push subscriptions found') {
        status = 200 // Not really an error, just no subscriptions
      } else if (result.message === 'Notification already read') {
        status = 200 // Not really an error, just already read
      }

      return NextResponse.json({
        success: false,
        message: result.message || result.error
      }, { status })
    }
  } catch (error: any) {
    console.error('[push-notifications] Error sending push notification:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

