"use client"

import { supabase } from '@/lib/supabase'
import { env } from '@/lib/env'

export interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

/**
 * Request notification permission and register service worker
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('[push-notifications] This browser does not support notifications')
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission === 'denied') {
    console.warn('[push-notifications] Notification permission denied')
    return false
  }

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

/**
 * Register service worker for push notifications
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[push-notifications] Service workers are not supported')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    })
    console.log('[push-notifications] Service Worker registered:', registration)
    return registration
  } catch (error) {
    console.error('[push-notifications] Service Worker registration failed:', error)
    return null
  }
}

/**
 * Get push subscription from service worker
 */
export async function getPushSubscription(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  try {
    const subscription = await registration.pushManager.getSubscription()
    return subscription
  } catch (error) {
    console.error('[push-notifications] Error getting push subscription:', error)
    return null
  }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(
  userId: string
): Promise<PushSubscriptionData | null> {
  const permission = await requestNotificationPermission()
  if (!permission) {
    console.warn('[push-notifications] Permission denied, cannot subscribe')
    return null
  }

  const registration = await registerServiceWorker()
  if (!registration) {
    console.warn('[push-notifications] Service Worker not available, cannot subscribe')
    return null
  }

  try {
    let subscription = await registration.pushManager.getSubscription()
    
    if (!subscription) {
      // Subscribe with VAPID public key
      const vapidPublicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      
      if (!vapidPublicKey) {
        console.error('[push-notifications] VAPID public key not configured')
        return null
      }
      
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
      })
    }

    const subscriptionData: PushSubscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
        auth: arrayBufferToBase64(subscription.getKey('auth')!)
      }
    }

    // Store subscription in Supabase
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscriptionData.endpoint,
        p256dh_key: subscriptionData.keys.p256dh,
        auth_key: subscriptionData.keys.auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,endpoint'
      })

    if (error) {
      console.error('[push-notifications] Error saving push subscription:', error)
      return null
    }

    console.log('[push-notifications] Successfully subscribed to push notifications')
    return subscriptionData
  } catch (error) {
    console.error('[push-notifications] Error subscribing to push notifications:', error)
    return null
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(
  userId: string
): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    
    if (subscription) {
      await subscription.unsubscribe()
    }

    // Remove from database (all subscriptions for this user)
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
    
    console.log('[push-notifications] Successfully unsubscribed from push notifications')
  } catch (error) {
    console.error('[push-notifications] Error unsubscribing from push notifications:', error)
  }
}

// Helper functions
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

