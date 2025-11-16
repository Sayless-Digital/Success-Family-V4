"use client"

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Bell, Check, MessageCircle, Heart, UserPlus, DollarSign, Calendar, AtSign, Users } from 'lucide-react'
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
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white/80 touch-feedback relative">
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
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="px-3 py-2 border-b border-white/20 flex items-center justify-between">
          <DropdownMenuLabel className="font-semibold text-white/90 px-0 text-sm">
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
        <div className="max-h-96 overflow-y-auto p-1.5">
          {loading ? (
            <div className="p-3 text-center text-white/60 text-sm">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-3 text-center text-white/60 text-sm">
              No notifications
            </div>
          ) : (
            <div className="space-y-1">
              {notifications.map((notification) => {
                const itemContent = (
                  <NotificationItem notification={notification} />
                )

                return notification.action_url ? (
                  <DropdownMenuItem
                    key={notification.id}
                    className={cn(
                      "p-0 cursor-pointer bg-white/5 hover:bg-white/10 focus:bg-white/10",
                      !notification.is_read && "bg-white/10"
                    )}
                    onSelect={(e) => {
                      e.preventDefault()
                      handleNotificationClick(notification)
                    }}
                    asChild
                  >
                    <Link href={notification.action_url}>
                      {itemContent}
                    </Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    key={notification.id}
                    className={cn(
                      "p-0 cursor-pointer bg-white/5 hover:bg-white/10 focus:bg-white/10",
                      !notification.is_read && "bg-white/10"
                    )}
                    onSelect={(e) => {
                      e.preventDefault()
                      handleNotificationClick(notification)
                    }}
                  >
                    {itemContent}
                  </DropdownMenuItem>
                )
              })}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NotificationItem({ notification }: { notification: Notification }) {
  // Get icon based on notification type
  const getNotificationIcon = () => {
    const iconClass = "h-4 w-4 text-white/70 flex-shrink-0"
    
    switch (notification.type) {
      case 'new_message':
        return <MessageCircle className={iconClass} />
      case 'post_comment':
        return <MessageCircle className={iconClass} />
      case 'post_boost':
        return <Heart className={iconClass} />
      case 'follow':
        return <UserPlus className={iconClass} />
      case 'community_invite':
        return <Users className={iconClass} />
      case 'payment_verified':
        return <DollarSign className={iconClass} />
      case 'event_reminder':
        return <Calendar className={iconClass} />
      case 'mention':
        return <AtSign className={iconClass} />
      default:
        return <Bell className={iconClass} />
    }
  }

  return (
    <div className="px-3 py-2.5 w-full transition-colors relative rounded-md flex gap-3">
      <div className="mt-0.5">
        {getNotificationIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white/90 text-sm leading-tight pr-6">
          {notification.title}
        </div>
        <div className="text-white/70 text-xs mt-1.5 line-clamp-2 leading-snug break-words">
          {notification.body}
        </div>
        <div className="text-white/50 text-xs mt-2">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </div>
      </div>
      {!notification.is_read && (
        <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-primary" />
      )}
    </div>
  )
}

