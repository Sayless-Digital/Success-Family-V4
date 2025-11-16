"use server"

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sendPushNotification } from '@/lib/push-notifications-server'
import type { NotificationType } from '@/types'

type TypedSupabaseClient = ReturnType<typeof createServerSupabaseClient> extends Promise<infer T> ? T : never

interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body: string
  actionUrl?: string
  metadata?: Record<string, unknown>
}

/**
 * Create a notification (triggers push notification via API route)
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<string | null> {
  console.log('[notifications] Creating notification:', {
    userId: input.userId,
    type: input.type,
    title: input.title
  })

  const supabase = await createServerSupabaseClient()
  
  // Use SECURITY DEFINER function to bypass RLS for server-side notification creation
  // This allows creating notifications for any user (e.g., when Alice boosts Bob's post,
  // Alice's server action creates a notification for Bob)
  const { data, error } = await supabase.rpc('create_notification', {
    p_user_id: input.userId,
    p_type: input.type,
    p_title: input.title,
    p_body: input.body,
    p_action_url: input.actionUrl || null,
    p_metadata: input.metadata || {}
  })
  
  // RPC returns the UUID directly, not a row object
  const notificationId = data as string | null

  if (error) {
    console.error('[notifications] ❌ Error creating notification:', error)
    console.error('[notifications] Database error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    })
    throw error
  }

  console.log('[notifications] ✅ Notification created successfully:', notificationId)

  // Trigger push notification asynchronously (fire and forget)
  // This avoids blocking the main request
  if (notificationId) {
    console.log('[notifications] Triggering push notification for notification ID:', notificationId)
    
    // Trigger push notification asynchronously (fire and forget)
    // Small delay to ensure notification is committed before pushing
    ;(async () => {
      // Wait a bit for notification to be committed to database
      await new Promise(resolve => setTimeout(resolve, 100))
      
      try {
        const result = await sendPushNotification(notificationId)
        
        if (result.success) {
          console.log('[notifications] ✅ Push notification sent successfully:', {
            sent: result.sent,
            total: result.total
          })
        } else {
          console.log('[notifications] ⚠️ Push notification not sent:', result.message || result.error)
        }
      } catch (error: any) {
        console.error('[notifications] ❌ Error sending push notification:', error)
        console.error('[notifications] Error details:', {
          message: error?.message,
          stack: error?.stack,
          name: error?.name
        })
        // Non-critical error - notification was still created in database
      }
    })()
  } else {
    console.warn('[notifications] ⚠️ No notificationId returned, cannot trigger push notification')
  }

  return notificationId || null
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq('id', notificationId)
    .eq('user_id', userId)

  if (error) {
    console.error('[notifications] Error marking notification as read:', error)
    throw error
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(
  userId: string
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) {
    console.error('[notifications] Error marking all notifications as read:', error)
    throw error
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(
  userId: string
): Promise<number> {
  const supabase = await createServerSupabaseClient()
  
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) {
    console.error('[notifications] Error getting unread count:', error)
    return 0
  }

  return count || 0
}

