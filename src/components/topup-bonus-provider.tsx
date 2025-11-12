"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { TopUpBonusDialog } from "@/components/topup-bonus-dialog"
import { supabase } from "@/lib/supabase"

export function TopUpBonusProvider() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [mounted, setMounted] = React.useState(false)
  const [showDialog, setShowDialog] = React.useState(false)
  const [bonusPoints, setBonusPoints] = React.useState(0)
  const [bonusEndTime, setBonusEndTime] = React.useState<string | null>(null)

  // Ensure we're on the client before doing anything
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const checkBonusEligibility = React.useCallback(async () => {
    if (!mounted) {
      console.log('[TopUpBonus] Not mounted yet, skipping check')
      return
    }

    if (!user) {
      console.log('[TopUpBonus] No user, hiding dialog')
      setShowDialog(false)
      return
    }

    console.log('[TopUpBonus] Checking bonus eligibility for user:', user.id)

    try {
      // Check if bonus is enabled and get bonus points
      const { data: settings, error } = await supabase
        .from('platform_settings')
        .select('topup_bonus_enabled, topup_bonus_points, topup_bonus_end_time')
        .eq('id', 1)
        .maybeSingle()

      if (error) {
        console.error('[TopUpBonus] Error fetching settings:', error)
        setShowDialog(false)
        return
      }

      console.log('[TopUpBonus] Settings:', {
        enabled: settings?.topup_bonus_enabled,
        points: settings?.topup_bonus_points,
        endTime: settings?.topup_bonus_end_time
      })

      if (!settings?.topup_bonus_enabled || !settings?.topup_bonus_points) {
        console.log('[TopUpBonus] Bonus not enabled or no points')
        setShowDialog(false)
        return
      }

      // Check if bonus has expired
      if (settings.topup_bonus_end_time) {
        const expirationTime = new Date(settings.topup_bonus_end_time)
        const now = new Date()
        if (now >= expirationTime) {
          console.log('[TopUpBonus] Bonus expired:', expirationTime)
          setShowDialog(false)
          return
        }
        console.log('[TopUpBonus] Bonus not expired, expires at:', expirationTime)
      }

      // Show dialog if bonus is enabled and not expired (shows every time during bonus period)
      console.log('[TopUpBonus] Showing dialog with', settings.topup_bonus_points, 'points')
      setBonusPoints(settings.topup_bonus_points)
      setBonusEndTime(settings.topup_bonus_end_time)
      setShowDialog(true)
    } catch (error) {
      console.error('[TopUpBonus] Error checking bonus eligibility:', error)
      setShowDialog(false)
    }
  }, [mounted, user])

  // Check when both mounted and user become available (handles initial load and reload)
  React.useEffect(() => {
    if (!mounted) {
      console.log('[TopUpBonus] Waiting for mount...')
      return
    }

    if (!user) {
      console.log('[TopUpBonus] Waiting for user...')
      setShowDialog(false)
      return
    }
    
    console.log('[TopUpBonus] Mounted and user available, checking eligibility')
    // Check immediately and also after delays to catch reloads
    checkBonusEligibility()
    const timeoutId1 = setTimeout(checkBonusEligibility, 1500)
    const timeoutId2 = setTimeout(checkBonusEligibility, 3000)
    return () => {
      clearTimeout(timeoutId1)
      clearTimeout(timeoutId2)
    }
  }, [mounted, user, checkBonusEligibility])

  // Check on route changes
  React.useEffect(() => {
    if (!mounted || !user) return
    
    const timeoutId = setTimeout(checkBonusEligibility, 1000)
    return () => clearTimeout(timeoutId)
  }, [mounted, pathname, user, checkBonusEligibility])

  // Check when page becomes visible or gains focus (handles tab switching, reload, and window focus)
  React.useEffect(() => {
    if (!mounted || !user || typeof window === 'undefined') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(checkBonusEligibility, 500)
      }
    }

    const handleFocus = () => {
      setTimeout(checkBonusEligibility, 500)
    }

    // Check on page load/reload
    const handleLoad = () => {
      setTimeout(checkBonusEligibility, 1500)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('load', handleLoad)
    
    // Also check immediately if page is already loaded
    if (document.readyState === 'complete') {
      setTimeout(checkBonusEligibility, 1500)
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('load', handleLoad)
    }
  }, [mounted, user, checkBonusEligibility])

  // Log dialog state changes
  React.useEffect(() => {
    console.log('[TopUpBonus] Dialog state changed:', {
      showDialog,
      bonusPoints,
      bonusEndTime,
      mounted,
      hasUser: !!user
    })
  }, [showDialog, bonusPoints, bonusEndTime, mounted, user])

  // Don't render anything until mounted to avoid hydration issues
  if (!mounted) {
    return null
  }

  return (
    <TopUpBonusDialog
      open={showDialog}
      onOpenChange={(open) => {
        console.log('[TopUpBonus] Dialog onOpenChange called with:', open)
        setShowDialog(open)
      }}
      bonusPoints={bonusPoints}
      bonusEndTime={bonusEndTime}
    />
  )
}

