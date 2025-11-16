# How to Check Logs for Push Notifications

## 📋 Server-Side Logs (Terminal)

**Where:** The terminal where you run `pnpm dev:https`

**What to look for when sending a message:**

### 1. Notification Creation
```
[notifications] Creating notification: { userId: '...', type: 'new_message', title: 'New message' }
[notifications] ✅ Notification created successfully: <notification-id>
```

### 2. Push Notification Trigger
```
[notifications] Triggering push notification via API route: http://localhost:3000/api/notifications/push
[notifications] Notification ID: <notification-id>
[notifications] Push API response status: 200 OK
```

### 3. Push Notification Processing
```
[push-notifications] Received push notification request for: <notification-id>
[push-notifications] Notification found: { id: '...', userId: '...', title: '...' }
[push-notifications] Found subscriptions: 1
[push-notifications] Sending push notifications to 1 devices...
[push-notifications] ✅ Push sent successfully to subscription: <subscription-id>
```

### 4. Message Sending (if from appendMessage)
```
[appendMessage] Starting notification creation for message: <message-id>
[appendMessage] Found participants: 2, other participants: 1
[appendMessage] Sender name: <name>
[appendMessage] Creating notification for participant: <user-id>
```

## ❌ Common Error Messages

### Notification not found
```
[push-notifications] ❌ Error fetching notification: ...
```
**Fix:** Check if notification was created (look for "✅ Notification created successfully")

### No push subscriptions
```
[push-notifications] ⚠️ No push subscriptions found for user, notification will only appear in-app
```
**Fix:** User needs to grant notification permission and subscribe to push

### VAPID keys not configured
```
[push-notifications] ⚠️ VAPID keys not configured, skipping push notification
```
**Fix:** Check `.env.local` has `VAPID_PRIVATE_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

### URL/Network error
```
[notifications] ❌ Error triggering push notification: ...
```
**Fix:** Check `NEXT_PUBLIC_APP_URL` is set correctly in `.env.local`

## 🌐 Browser Console Logs

**Where:** Browser DevTools → Console tab (F12)

**What to look for:**
- Service worker registration: `[push-notifications] Service Worker registered`
- Push subscription: `[push-notifications] ✅ Successfully subscribed to push notifications`
- Push event received: `[SW] Push event received` (in service worker console)

## 🔍 Quick Debug Steps

1. **Send a test message**
2. **Check terminal** for `[notifications]` and `[push-notifications]` logs
3. **Check browser console** for any errors
4. **Verify** notification was created in database:
   - Go to `/account` page
   - Look at "Notification Debug" section
   - Check "DB notifications" count

## 📝 Service Worker Logs

Service worker logs appear in:
- **Chrome/Edge:** DevTools → Application → Service Workers → Click "console" link next to your service worker
- **Firefox:** DevTools → Application → Service Workers → Click your service worker → Console tab

Look for:
- `[SW] Push event received`
- `[SW] Showing notification: ...`


