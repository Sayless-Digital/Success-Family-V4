"use client"

import { Component, ReactNode } from "react"
import { useRouter } from "next/navigation"
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
 * 
 * Note: Error boundaries must be class components, but we need router from hooks.
 * We'll use a wrapper component to provide the router.
 */
class StreamErrorBoundaryInner extends Component<Props & { router: ReturnType<typeof useRouter> }, State> {
  constructor(props: Props & { router: ReturnType<typeof useRouter> }) {
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
                  // Use Next.js router instead of window.location to avoid full page refresh
                  this.props.router.push(`/${this.props.communitySlug}/events`)
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

/**
 * Wrapper component that provides router to the error boundary
 */
export function StreamErrorBoundary({ children, communitySlug, onError }: Props) {
  const router = useRouter()
  return (
    <StreamErrorBoundaryInner router={router} communitySlug={communitySlug} onError={onError}>
      {children}
    </StreamErrorBoundaryInner>
  )
}