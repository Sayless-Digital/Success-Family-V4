import { NextRequest, NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'
import type { NotificationType } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, type, title, body: bodyText, actionUrl, metadata } = body

    if (!userId || !type || !title || !bodyText) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, type, title, body' },
        { status: 400 }
      )
    }

    // Validate notification type
    const validTypes: NotificationType[] = [
      'new_message',
      'post_comment',
      'post_boost',
      'community_invite',
      'payment_verified',
      'event_reminder',
      'follow',
      'mention'
    ]

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid notification type' },
        { status: 400 }
      )
    }

    // Create notification
    const notificationId = await createNotification({
      userId,
      type,
      title,
      body: bodyText,
      actionUrl,
      metadata
    })

    return NextResponse.json({ 
      success: true, 
      notificationId 
    })
  } catch (error: any) {
    console.error('[api/notifications/create] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create notification' },
      { status: 500 }
    )
  }
}



