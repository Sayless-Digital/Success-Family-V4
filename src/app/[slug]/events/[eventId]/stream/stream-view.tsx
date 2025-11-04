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

  useEffect(() => {
    // Prevent multiple initializations (especially important in React StrictMode)
    if (isInitializedRef.current) {
      return
    }
    
    let mounted = true
    isInitializedRef.current = true

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
        // Add options to handle WebSocket issues in development
        const streamClient = new StreamVideoClient({
          apiKey,
          token,
          tokenProvider,
          user: {
            id: currentUserId,
            name: currentUserName,
            image: currentUserImage || undefined,
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
        
        // Update state
        setCall(streamCall)
        setClient(streamClient)
        setIsLoading(false)

        // Update registration joined_at if user is registered
        if (registrationId) {
          await supabase
            .from('event_registrations')
            .update({ joined_at: new Date().toISOString() })
            .eq('id', registrationId)
        }
      } catch (error: any) {
        console.error('Error initializing stream:', error)
        if (mounted) {
          setError(error.message || 'Failed to connect to stream')
          setIsLoading(false)
          toast.error(error.message || 'Failed to connect to stream')
        }
      }
    }

    initializeStream()

    // Cleanup function with refs to ensure we have latest values
    return () => {
      mounted = false
      
      // Use refs for cleanup to avoid stale closure
      const currentCall = callRef.current
      const currentClient = clientRef.current
      
      if (currentCall) {
        currentCall.leave().catch((err) => {
          console.error('Error leaving call during cleanup:', err)
        })
      }
      
      if (currentClient) {
        currentClient.disconnectUser().catch((err) => {
          console.error('Error disconnecting client during cleanup:', err)
        })
      }
      
      // Clear refs
      callRef.current = null
      clientRef.current = null
    }
  }, [currentUserId, currentUserName, currentUserImage, event.id, event.stream_call_id, registrationId])

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