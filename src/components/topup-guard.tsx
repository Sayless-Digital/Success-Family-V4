"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTopupCheck } from "@/hooks/use-topup-check"
import { TopUpDialog } from "@/components/topup-dialog"
import { AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface TopUpGuardProps {
  children: React.ReactNode
  communitySlug?: string
}

/**
 * Guard component that protects pages requiring top-up
 * Shows top-up dialog if user needs to top up
 * Redirects to community home if user dismisses without topping up
 */
export function TopUpGuard({ children, communitySlug }: TopUpGuardProps) {
  const { needsTopup, topupMessage, hasUser, isChecking } = useTopupCheck()
  const router = useRouter()
  const [showTopupDialog, setShowTopupDialog] = useState(false)
  const [userDismissed, setUserDismissed] = useState(false)

  useEffect(() => {
    if (isChecking) {
      return
    }

    if (needsTopup && hasUser) {
      setShowTopupDialog(true)
    } else {
      setShowTopupDialog(false)
    }
  }, [needsTopup, hasUser, isChecking])

  useEffect(() => {
    if (!needsTopup) {
      setUserDismissed(false)
    }
  }, [needsTopup])

  const handleDialogChange = (open: boolean) => {
    setShowTopupDialog(open)
    if (!open && needsTopup) {
      // User closed dialog without topping up
      setUserDismissed(true)
      // Redirect to community home or communities list
      if (communitySlug) {
        router.push(`/${communitySlug}`)
      } else {
        router.push('/communities')
      }
    }
  }

  // If user needs top-up and has dismissed, show blocking message
  if (needsTopup && userDismissed) {
    return (
      <div className="relative w-full overflow-x-hidden">
        <div className="relative z-10 flex items-center justify-center min-h-[60vh]">
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 max-w-md mx-4">
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-16 w-16 text-amber-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Top-Up Required</h2>
              <p className="text-white/80 mb-6">
                {topupMessage || "Please complete your top-up to access this page."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Show nothing while checking to prevent flash
  if (isChecking) {
    return null
  }

  // If user needs top-up, show dialog and block content
  if (needsTopup) {
    return (
      <>
        <TopUpDialog
          open={showTopupDialog}
          onOpenChange={handleDialogChange}
          message={topupMessage || undefined}
          actionText="Top Up to Access This Page"
        />
        <div className="relative w-full overflow-x-hidden">
          <div className="relative z-10 flex items-center justify-center min-h-[60vh]">
            <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 max-w-md mx-4">
              <CardContent className="p-8 text-center">
                <AlertCircle className="h-16 w-16 text-amber-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Top-Up Required</h2>
                <p className="text-white/80">
                  {topupMessage || "Please complete your top-up to access this page."}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    )
  }

  // User doesn't need top-up, render children
  return <>{children}</>
}