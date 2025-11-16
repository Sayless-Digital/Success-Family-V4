"use server"

import { createServerSupabaseClient } from '@/lib/supabase-server'
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
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      action_url: input.actionUrl || null,
      metadata: input.metadata || {}
    })
    .select('id')
    .single()

  if (error) {
    console.error('[notifications] Error creating notification:', error)
    throw error
  }

  // Trigger push notification asynchronously (fire and forget)
  // This avoids blocking the main request
  if (data?.id) {
    // Use absolute URL for server-side fetch
    // NEXT_PUBLIC_APP_URL should be set in production (e.g., https://yourdomain.com)
    // In development, this will use localhost, but you may need to set NEXT_PUBLIC_APP_URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
    
    // Call API route to send push notification (non-blocking)
    fetch(`${baseUrl}/api/notifications/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notificationId: data.id })
    }).catch(error => {
      console.error('[notifications] Error triggering push notification:', error)
      // Non-critical error - notification was still created in database
    })
  }

  return data?.id || null
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

