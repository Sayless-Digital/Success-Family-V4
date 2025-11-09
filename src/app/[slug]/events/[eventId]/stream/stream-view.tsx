"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  StreamVideo,
  StreamVideoClient,
  type Call,
} from "@stream-io/video-react-sdk"
import "@stream-io/video-react-sdk/dist/css/styles.css"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { env } from "@/lib/env"
import { toast } from "sonner"
import type { CommunityEvent } from "@/types"
import { CallContent } from "./components/call-content"
import { WebSocketErrorSuppressor } from "./websocket-error-suppressor"

interface StreamViewProps {
  event: CommunityEvent
  community: {
    id: string
    name: string
    slug: string
    logo_url?: string | null
  }
  currentUserId: string
  currentUserName: string
  currentUserImage?: string | null
  isOwner: boolean
  registrationId?: string
}

/**
 * Main Stream View Component
 * Handles Stream.io client initialization and call setup
 */
export default function StreamView({
  event,
  community,
  currentUserId,
  currentUserName,
  currentUserImage,
  isOwner,
  registrationId,
}: StreamViewProps) {
  const router = useRouter()
  const [client, setClient] = useState<StreamVideoClient | null>(null)
  const [call, setCall] = useState<Call | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Use refs to track client and call for cleanup - ensures cleanup has latest values
  const clientRef = useRef<StreamVideoClient | null>(null)
  const callRef = useRef<Call | null>(null)
  const isInitializedRef = useRef(false)
  // Store user values in refs so they don't trigger reinitialization
  const userRef = useRef({ currentUserId, currentUserName, currentUserImage })
  
  // Update user refs when they change (but don't trigger reinitialization)
  useEffect(() => {
    userRef.current = { currentUserId, currentUserName, currentUserImage }
  }, [currentUserId, currentUserName, currentUserImage])
  
  // Track the event/call ID we initialized with to prevent unnecessary reinitializations
  const initializedCallIdRef = useRef<string | null>(null)
  // Track if initialization is in progress to prevent concurrent initializations
  const isInitializingRef = useRef(false)
  // Track the previous dependency values to detect actual changes
  const prevDepsRef = useRef<{ eventId: string; callId: string } | null>(null)

  useEffect(() => {
    // Get the call ID for this effect run - use stable string values
    const callId = event.stream_call_id || event.id
    const eventId = event.id
    
    // Check if dependencies actually changed
    const prevDeps = prevDepsRef.current
    const depsChanged = !prevDeps || prevDeps.eventId !== eventId || prevDeps.callId !== callId
    
    // Check if we already have an active connection to this call
    // Only skip initialization if we have both a client AND a call for this call ID
    // AND the dependencies haven't changed
    if (!depsChanged && clientRef.current && callRef.current && initializedCallIdRef.current === callId) {
      // Already have an active connection and dependencies haven't changed, don't reinitialize
      return
    }
    
    // Prevent concurrent initializations
    if (isInitializingRef.current) {
      console.log('[Stream] Initialization already in progress, skipping...')
      return
    }
    
    // Store the old call ID before updating (for cleanup logic)
    const oldCallId = initializedCallIdRef.current
    
    // If we have an existing connection to a different call, clean it up first
    if ((clientRef.current || callRef.current) && oldCallId && oldCallId !== callId) {
      console.log('[Stream] Call ID changed, cleaning up existing connection...')
      const currentCall = callRef.current
      const currentClient = clientRef.current
      
      if (currentCall) {
        currentCall.leave().catch((err) => {
          console.error('Error leaving call during reinitialization:', err)
        })
      }
      
      if (currentClient) {
        currentClient.disconnectUser().catch((err) => {
          console.error('Error disconnecting client during reinitialization:', err)
        })
      }
      
      // Clear refs and state before reinitializing
      callRef.current = null
      clientRef.current = null
      setCall(null)
      setClient(null)
      isInitializedRef.current = false
    }
    
    // Update dependency tracking
    prevDepsRef.current = { eventId, callId }
    
    let mounted = true
    isInitializingRef.current = true
    // Don't set initializedCallIdRef until after successful initialization
    
    // Add global error handler to prevent unhandled Stream SDK errors from causing page refresh
    const originalErrorHandler = window.onerror
    const handleError = (message: string | Event, source?: string, lineno?: number, colno?: number, error?: Error) => {
      // Suppress Stream SDK errors that might cause page refresh
      const errorStr = String(message) + (error?.message || '')
      if (errorStr.includes('Stream') || errorStr.includes('WebSocket') || errorStr.includes('Invalid WebSocket frame')) {
        console.log('[Stream] Suppressed error from causing page refresh:', message)
        return true // Prevent default error handling (page refresh)
      }
      // Call original handler for other errors
      if (originalErrorHandler && typeof message === 'string') {
        return originalErrorHandler(message, source, lineno, colno, error)
      }
      return false
    }
    
    window.onerror = handleError as any

    async function initializeStream() {
      try {
        const apiKey = env.NEXT_PUBLIC_GETSTREAM_API_KEY
        if (!apiKey) {
          throw new Error('GetStream API key not configured')
        }

        // Get Stream token
        const tokenResponse = await fetch('/api/stream-token', {
          method: 'POST',
          credentials: 'include',
        })

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json().catch(() => ({}))
          throw new Error(errorData.error || `Failed to get Stream token: ${tokenResponse.status}`)
        }

        const { token } = await tokenResponse.json()
        
        if (!token) {
          throw new Error('No token received from server')
        }

        if (!mounted) return

        // Create token provider function for automatic token refresh
        const tokenProvider = async () => {
          const tokenResponse = await fetch('/api/stream-token', {
            method: 'POST',
            credentials: 'include',
          })
          
          if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json().catch(() => ({}))
            throw new Error(errorData.error || `Failed to refresh token: ${tokenResponse.status}`)
          }
          
          const { token: newToken } = await tokenResponse.json()
          if (!newToken) {
            throw new Error('No token received from server')
          }
          
          return newToken
        }

        // Initialize Stream client with token provider for automatic refresh
        // Use refs to get latest user values (they may have changed since effect started)
        const user = userRef.current
        const streamClient = new StreamVideoClient({
          apiKey,
          token,
          tokenProvider,
          user: {
            id: user.currentUserId,
            name: user.currentUserName,
            image: user.currentUserImage || undefined,
          },
          options: {
            timeout: 6000,
            logger: (logLevel, message, extraData) => {
              // Only log errors in production, suppress WebSocket frame errors
              if (logLevel === 'error' && !message.includes('Invalid WebSocket frame')) {
                console.error('[Stream]', message, extraData)
              }
            },
          },
        })

        // Add error handler for WebSocket issues
        streamClient.on('connection.changed', (event) => {
          console.log('[Stream] Connection changed:', event.online ? 'online' : 'offline')
          if (!event.online) {
            console.warn('[Stream] Connection lost, will attempt to reconnect...')
          }
        })

        streamClient.on('connection.error', (error) => {
          // Suppress WebSocket frame errors from propagating (known development issue)
          const errorStr = JSON.stringify(error)
          if (errorStr.includes('Invalid WebSocket frame') || errorStr.includes('WS_ERR_INVALID')) {
            console.log('[Stream] Ignoring WebSocket frame error (known dev issue)')
            return
          }
          console.error('[Stream] Connection error:', error)
        })

        if (!mounted) {
          await streamClient.disconnectUser().catch(console.error)
          return
        }

        // Get or create call - use 'default' type to allow all participants
        const callId = event.stream_call_id || event.id
        const streamCall = streamClient.call('default', callId)

        // Ensure camera and microphone are disabled before joining
        await streamCall.camera.disable()
        await streamCall.microphone.disable()

        // Join call with devices disabled
        await streamCall.join({ create: true })

        if (!mounted) {
          await streamCall.leave().catch(console.error)
          await streamClient.disconnectUser().catch(console.error)
          return
        }

        // Store in refs for cleanup
        clientRef.current = streamClient
        callRef.current = streamCall
        
        // Mark as initialized only after successful connection
        isInitializedRef.current = true
        initializedCallIdRef.current = callId
        isInitializingRef.current = false
        
        // Update state
        setCall(streamCall)
        setClient(streamClient)
        setIsLoading(false)
        
        console.log('[Stream] Successfully initialized and connected to call:', callId)

        // Update registration joined_at if user is registered
        // Use a ref to get the latest registrationId (it may have changed)
        const currentRegistrationId = registrationId
        if (currentRegistrationId) {
          await supabase
            .from('event_registrations')
            .update({ joined_at: new Date().toISOString() })
            .eq('id', currentRegistrationId)
        }
      } catch (error: any) {
        console.error('Error initializing stream:', error)
        if (mounted) {
          // Reset initialization state on error so we can retry
          isInitializedRef.current = false
          initializedCallIdRef.current = null
          isInitializingRef.current = false
          callRef.current = null
          clientRef.current = null
          
          setError(error.message || 'Failed to connect to stream')
          setIsLoading(false)
          toast.error(error.message || 'Failed to connect to stream')
          // Prevent error from bubbling up and causing page refresh
          // Errors are now handled gracefully in the UI
        }
      }
    }

    initializeStream()

    // Cleanup function - runs when dependencies change or component unmounts
    return () => {
      mounted = false
      isInitializingRef.current = false
      
      // Restore original error handler
      window.onerror = originalErrorHandler
      
      // DON'T cleanup connections here - let the new effect handle it
      // This prevents race conditions and double-cleanup
      // The new effect will:
      // 1. Check if dependencies changed
      // 2. If same dependencies, return early (keep connection)
      // 3. If different dependencies, cleanup old connection and initialize new one
      //
      // For component unmount, React will eventually garbage collect, but we should
      // still cleanup. However, we can't reliably detect unmount vs re-render.
      // The safest approach is to let the effect handle all cleanup logic.
    }
  }, [event.id, event.stream_call_id]) // Only depend on event/call ID, not user props

  // Separate effect to handle cleanup on unmount
  useEffect(() => {
    return () => {
      // Component is unmounting - cleanup connections
      const currentCall = callRef.current
      const currentClient = clientRef.current
      
      if (currentCall) {
        currentCall.leave().catch((err) => {
          console.error('Error leaving call on unmount:', err)
        })
      }
      
      if (currentClient) {
        currentClient.disconnectUser().catch((err) => {
          console.error('Error disconnecting client on unmount:', err)
        })
      }
    }
  }, []) // Empty deps - only runs on mount/unmount

  const handleEndCall = async () => {
    try {
      if (call) {
        await call.leave()
      }

      // Update event status if owner ends call
      if (isOwner) {
        await supabase
          .from('community_events')
          .update({
            status: 'completed',
            ended_at: new Date().toISOString(),
          })
          .eq('id', event.id)
      }

      router.push(`/${community.slug}/events`)
    } catch (error: any) {
      console.error('Error ending call:', error)
      toast.error('Failed to end call')
    }
  }

  if (isLoading || !client) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white mx-auto" />
          <p className="text-white/80">Connecting to stream...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="bg-white/10 backdrop-blur-md border-0">
          <CardContent className="p-8 text-center">
            <p className="text-white/80 mb-4">{error}</p>
            <Button
              onClick={() => router.push(`/${community.slug}/events`)}
              className="bg-white/10 text-white/80 hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Events
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!call) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white mx-auto" />
          <p className="text-white/80">Connecting to stream...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <WebSocketErrorSuppressor />
      <StreamVideo client={client}>
        <CallContent
          event={event}
          community={community}
          isOwner={isOwner}
          onEndCall={handleEndCall}
          call={call}
          currentUserName={currentUserName}
          currentUserImage={currentUserImage}
        />
      </StreamVideo>
    </>
  )
}