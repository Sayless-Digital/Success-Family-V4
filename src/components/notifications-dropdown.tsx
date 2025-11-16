"use client"

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Bell, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { markNotificationAsRead, markAllNotificationsAsRead } from '@/lib/notifications'
import type { Notification } from '@/types'
import { formatDistanceToNow } from 'date-fns'

interface NotificationsDropdownProps {
  userId: string
}

export function NotificationsDropdown({ userId }: NotificationsDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    if (!userId) return

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error

      if (data) {
        setNotifications(data as Notification[])
        setUnreadCount(data.filter((n) => !n.is_read).length)
      }
    } catch (error) {
      console.error('[notifications-dropdown] Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadNotifications()

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newNotification = payload.new as Notification
          setNotifications((prev) => [newNotification, ...prev])
          if (!newNotification.is_read) {
            setUnreadCount((prev) => prev + 1)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const updated = payload.new as Notification
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          )
          // Recalculate unread count
          loadNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, loadNotifications])

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      try {
        await markNotificationAsRead(notification.id, userId)
        // Update local state optimistically
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch (error) {
        console.error('[notifications-dropdown] Error marking notification as read:', error)
      }
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead(userId)
      // Update local state optimistically
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          is_read: true,
          read_at: new Date().toISOString()
        }))
      )
      setUnreadCount(0)
    } catch (error) {
      console.error('[notifications-dropdown] Error marking all as read:', error)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white/80 touch-feedback relative hidden md:flex">
          <Bell className="h-4 w-4 text-white/70" />
          {unreadCount > 0 && (
            <Badge 
              key={`notifications-unread-${unreadCount}`}
              className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center bg-white/90 text-black border-0 text-[9px] font-semibold shadow-md"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="p-4 border-b border-white/20 flex items-center justify-between">
          <DropdownMenuLabel className="font-semibold text-white/90 px-0">
            Notifications
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="h-6 px-2 text-xs text-white/70 hover:text-white/90 hover:bg-white/10"
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-white/60 text-sm">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-white/60 text-sm">
              No notifications
            </div>
          ) : (
            notifications.map((notification) => {
              const content = notification.action_url ? (
                <Link
                  href={notification.action_url}
                  className="block"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <NotificationItem notification={notification} />
                </Link>
              ) : (
                <div onClick={() => handleNotificationClick(notification)}>
                  <NotificationItem notification={notification} />
                </div>
              )

              return (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    "p-0 cursor-pointer focus:bg-white/10",
                    !notification.is_read && "bg-white/5"
                  )}
                  onSelect={(e) => {
                    e.preventDefault()
                    if (!notification.action_url) {
                      handleNotificationClick(notification)
                    }
                  }}
                >
                  {content}
                </DropdownMenuItem>
              )
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NotificationItem({ notification }: { notification: Notification }) {
  return (
    <div className="p-4 w-full hover:bg-white/5 transition-colors relative">
      <div className="font-medium text-white/90 text-sm">
        {notification.title}
      </div>
      <div className="text-white/70 text-xs mt-1 line-clamp-2">
        {notification.body}
      </div>
      <div className="text-white/50 text-xs mt-2">
        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
      </div>
      {!notification.is_read && (
        <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-primary" />
      )}
    </div>
  )
}

