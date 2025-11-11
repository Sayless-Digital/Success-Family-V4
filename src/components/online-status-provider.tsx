"use client"

import React, { createContext, useContext, useEffect, useState, useRef } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"

const GLOBAL_PRESENCE_CHANNEL = "global-presence"

interface OnlineStatusContextType {
  onlineUserIds: Set<string>
  isUserOnline: (userId: string) => boolean
}

const OnlineStatusContext = createContext<OnlineStatusContextType>({
  onlineUserIds: new Set(),
  isUserOnline: () => false,
})

export function useOnlineStatus() {
  return useContext(OnlineStatusContext)
}

export function OnlineStatusProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!user?.id) {
      setOnlineUserIds(new Set())
      return
    }

    const channel = supabase
      .channel(GLOBAL_PRESENCE_CHANNEL, {
        config: {
          presence: {
            key: user.id,
          },
        },
      })
    
    channelRef.current = channel

    const updateOnlineUsers = () => {
      const state = channel.presenceState<{ userId: string }>()
      const onlineIds = new Set<string>()
      
      Object.values(state).forEach((presences) => {
        if (Array.isArray(presences)) {
          presences.forEach((presence) => {
            if (presence && presence.userId) {
              onlineIds.add(presence.userId)
            }
          })
        }
      })
      
      setOnlineUserIds(onlineIds)
    }

    channel
      .on('presence', { event: 'sync' }, updateOnlineUsers)
      .on('presence', { event: 'join' }, updateOnlineUsers)
      .on('presence', { event: 'leave' }, updateOnlineUsers)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            // Initial presence tracking
            await channel.track({
              userId: user.id,
              online_at: new Date().toISOString()
            })
            
            // Set up heartbeat to keep presence alive (every 30 seconds)
            // Supabase presence expires after ~60 seconds of inactivity
            heartbeatIntervalRef.current = setInterval(async () => {
              try {
                if (channelRef.current) {
                  await channelRef.current.track({
                    userId: user.id,
                    online_at: new Date().toISOString()
                  })
                }
              } catch (error) {
                console.error('[OnlineStatusProvider] Failed to send heartbeat:', error)
              }
            }, 30000)
          } catch (error) {
            console.error('[OnlineStatusProvider] Failed to track presence:', error)
          }
        }
      })

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [user?.id])

  const isUserOnline = React.useCallback((userId: string) => {
    return onlineUserIds.has(userId)
  }, [onlineUserIds])

  return (
    <OnlineStatusContext.Provider value={{ onlineUserIds, isUserOnline }}>
      {children}
    </OnlineStatusContext.Provider>
  )
}

