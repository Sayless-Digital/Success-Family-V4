"use client"

import { Component, ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

interface Props {
  children: ReactNode
  communitySlug: string
  onError?: (error: Error) => void
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * Error Boundary for Stream View
 * Catches WebSocket frame errors that are common in development
 */
export class StreamErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Filter out WebSocket frame errors (known development issue)
    if (
      error.message?.includes('Invalid WebSocket frame') ||
      error.message?.includes('WS_ERR_INVALID') ||
      error.message?.includes('invalid status code')
    ) {
      console.log('[Stream] Suppressing WebSocket frame error:', error.message)
      return { hasError: false }
    }
    
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Don't log WebSocket frame errors
    if (
      error.message?.includes('Invalid WebSocket frame') ||
      error.message?.includes('WS_ERR_INVALID') ||
      error.message?.includes('invalid status code')
    ) {
      return
    }

    console.error('[Stream] Error caught by boundary:', error, errorInfo)
    this.props.onError?.(error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Card className="bg-white/10 backdrop-blur-md border-0">
            <CardContent className="p-8 text-center">
              <p className="text-white/80 mb-4">
                {this.state.error?.message || 'Something went wrong with the stream'}
              </p>
              <Button
                onClick={() => {
                  window.location.href = `/${this.props.communitySlug}/events`
                }}
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

    return this.props.children
  }
}