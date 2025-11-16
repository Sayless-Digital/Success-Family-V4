"use client"

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { subscribeToPushNotifications } from '@/lib/push-notifications'
import { createNotification } from '@/lib/notifications'

/**
 * Debug component to test notifications
 * Add this temporarily to check what's happening
 */
export function NotificationDebug() {
  const { user } = useAuth()
  const [status, setStatus] = useState<Record<string, string>>({})
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    if (!user?.id) return

    const checkStatus = async () => {
      const checks: Record<string, string> = {}

      // Check browser support
      checks['Browser notifications'] = 'Notification' in window ? '✅ Supported' : '❌ Not supported'
      checks['Service workers'] = 'serviceWorker' in navigator ? '✅ Supported' : '❌ Not supported'

      // Check notification permission
      if ('Notification' in window) {
        checks['Notification permission'] = Notification.permission
      }

      // Check service worker registration
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        checks['Service worker registered'] = registration ? '✅ Yes' : '❌ No'
        if (registration) {
          checks['Service worker scope'] = registration.scope
        }
      } catch (error: any) {
        checks['Service worker registered'] = `❌ Error: ${error.message}`
      }

      // Check push subscription
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        checks['Push subscription'] = subscription ? '✅ Subscribed' : '❌ Not subscribed'
        if (subscription) {
          checks['Push endpoint'] = subscription.endpoint.substring(0, 50) + '...'
        }
      } catch (error: any) {
        checks['Push subscription'] = `❌ Error: ${error.message}`
      }

      // Check database subscriptions
      const { data: dbSubscriptions, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user.id)

      checks['DB push subscriptions'] = subError 
        ? `❌ Error: ${subError.message}`
        : `${dbSubscriptions?.length || 0} found`

      // Check database notifications
      const { data: dbNotifications, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      checks['DB notifications'] = notifError
        ? `❌ Error: ${notifError.message}`
        : `${dbNotifications?.length || 0} found`

      setStatus(checks)
      setNotifications(dbNotifications || [])
    }

    checkStatus()
  }, [user?.id])

  const handleTestPush = async () => {
    if (!user?.id) return

    try {
      // Try to subscribe first
      const result = await subscribeToPushNotifications(user.id)
      if (result) {
        alert('✅ Push subscription successful!')
        window.location.reload()
      } else {
        alert('❌ Failed to subscribe. Check console for errors.')
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`)
      console.error('Push subscription error:', error)
    }
  }

  const handleTestNotification = async () => {
    if (!user?.id) return

    try {
      // Create a test notification
      const response = await fetch('/api/notifications/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          type: 'follow',
          title: 'Test Notification',
          body: 'This is a test notification to verify the system is working',
          actionUrl: '/profile/' + user.id,
        })
      })

      const data = await response.json()
      if (data.success) {
        alert('✅ Test notification created! Check the bell icon.')
        window.location.reload()
      } else {
        alert(`❌ Failed: ${data.error || 'Unknown error'}`)
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`)
      console.error('Test notification error:', error)
    }
  }

  const handleTestPushNotification = async () => {
    if (!user?.id) return

    try {
      // First create a notification
      const createResponse = await fetch('/api/notifications/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          type: 'follow',
          title: 'Browser Push Test',
          body: 'If you see this as a browser notification (not just in-app), push notifications are working!',
          actionUrl: '/',
        })
      })

      const createData = await createResponse.json()
      if (!createData.success || !createData.notificationId) {
        alert(`❌ Failed to create notification: ${createData.error || 'Unknown error'}`)
        return
      }

      // Then trigger push notification
      const pushResponse = await fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: createData.notificationId
        })
      })

      const pushData = await pushResponse.json()
      
      if (pushData.success) {
        alert(`✅ Push notification sent to ${pushData.sent}/${pushData.total} device(s)!\n\n💡 TIP: Put this tab in the background or minimize the browser to see the browser notification appear.`)
        window.location.reload()
      } else {
        alert(`⚠️ ${pushData.message || 'Push notification failed'}\n\nCheck the debug info above to see if:\n- Push subscription exists\n- Notification permission is granted\n- Service worker is registered`)
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`)
      console.error('Test push notification error:', error)
    }
  }

  if (!user) {
    return (
      <div className="p-4 bg-white/5 rounded-lg border border-white/20">
        <p className="text-white/70">Please sign in to test notifications</p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-white/5 rounded-lg border border-white/20 space-y-4">
      <div>
        <h3 className="text-white/90 font-semibold mb-2">Push Notifications Debug</h3>
        <div className="text-white/60 text-xs space-y-1 mb-4">
          <p><strong>How browser push notifications work:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>They appear as <strong>system/browser notifications</strong> (like Chrome/Edge notifications), NOT in-app</li>
            <li>They work even when the browser tab is <strong>closed or minimized</strong></li>
            <li>You need to <strong>grant notification permission</strong> when prompted</li>
            <li>Push notifications require an <strong>active internet connection</strong> (browser push service handles delivery)</li>
            <li><strong>To test:</strong> Subscribe to push, then minimize the browser or switch tabs before clicking "Test Push Notification"</li>
          </ul>
        </div>
      </div>
      
      <div className="space-y-2">
        {Object.entries(status).map(([key, value]) => (
          <div key={key} className="flex justify-between text-sm">
            <span className="text-white/70">{key}:</span>
            <span className="text-white/90 font-mono text-xs">{value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={handleTestPush} variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
          Test Push Subscription
        </Button>
        <Button onClick={handleTestNotification} variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
          Create Test Notification (In-App)
        </Button>
        <Button onClick={handleTestPushNotification} variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
          Test Browser Push Notification
        </Button>
      </div>

      {notifications.length > 0 && (
        <div>
          <p className="text-white/70 text-sm mb-2">Recent notifications:</p>
          <div className="space-y-1">
            {notifications.map((n) => (
              <div key={n.id} className="text-xs text-white/60 p-2 bg-white/5 rounded">
                <div className="font-medium">{n.title}</div>
                <div>{n.body}</div>
                <div className="text-white/40">{new Date(n.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


