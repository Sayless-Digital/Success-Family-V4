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
  const hasCheckedRef = React.useRef(false)
  const isCheckingRef = React.useRef(false)
  const prevUserRef = React.useRef<string | null>(null)

  // Ensure we're on the client before doing anything
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const checkBonusEligibility = React.useCallback(async (isNewSignIn = false) => {
    if (!mounted) {
      return
    }

    if (!user) {
      setShowDialog(false)
      return
    }

    // Prevent multiple simultaneous checks
    if (isCheckingRef.current) {
      return
    }

    // Don't check again if dialog is already open (user might have just dismissed it)
    if (showDialog) {
      return
    }

    isCheckingRef.current = true

    // Check if 10 minutes have passed since last show (only if not a new sign-in)
    // On new sign-in, always show if eligible
    // Use sessionStorage so cooldown resets on each sign-in
    if (!isNewSignIn) {
      const storageKey = `topup_bonus_last_shown_${user.id}`
      const lastShown = typeof window !== 'undefined' ? sessionStorage.getItem(storageKey) : null
      
      if (lastShown) {
        const lastShownTime = parseInt(lastShown, 10)
        const now = Date.now()
        const tenMinutes = 10 * 60 * 1000 // 10 minutes in milliseconds
        const timeSinceLastShow = now - lastShownTime
        
        if (timeSinceLastShow < tenMinutes) {
          setShowDialog(false)
          isCheckingRef.current = false
          return
        }
      }
    }

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

      if (!settings?.topup_bonus_enabled || !settings?.topup_bonus_points) {
        setShowDialog(false)
        return
      }

      // Check if bonus has expired
      if (settings.topup_bonus_end_time) {
        const expirationTime = new Date(settings.topup_bonus_end_time)
        const now = new Date()
        if (now >= expirationTime) {
          setShowDialog(false)
          return
        }
      }
      setBonusPoints(settings.topup_bonus_points)
      setBonusEndTime(settings.topup_bonus_end_time)
      setShowDialog(true)
      hasCheckedRef.current = true
      
      // Store the current time when dialog is shown (use sessionStorage for session-based cooldown)
      if (typeof window !== 'undefined') {
        const storageKey = `topup_bonus_last_shown_${user.id}`
        sessionStorage.setItem(storageKey, Date.now().toString())
        // Mark that we've checked in this session (prevents showing on every page load)
        sessionStorage.setItem('topup_bonus_session_checked', user.id)
      }
    } catch (error) {
      console.error('[TopUpBonus] Error checking bonus eligibility:', error)
      setShowDialog(false)
    } finally {
      isCheckingRef.current = false
    }
  }, [mounted, user, showDialog])

  // Check when both mounted and user become available (handles initial load and reload)
  React.useEffect(() => {
    if (!mounted) {
      return
    }

    if (!user) {
      setShowDialog(false)
      // Reset check flag when user signs out
      if (prevUserRef.current) {
        hasCheckedRef.current = false
        prevUserRef.current = null
        // Clear session check flags on sign out
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('topup_bonus_session_checked')
          sessionStorage.removeItem('topup_bonus_previous_user_id')
        }
      }
      return
    }

    const currentUserId = user.id
    const previousUserId = prevUserRef.current

    // Get previous user ID from sessionStorage (persists across page loads)
    const storedPreviousUserId = typeof window !== 'undefined'
      ? sessionStorage.getItem('topup_bonus_previous_user_id')
      : null

    // Check if we've already checked in this session (persists across page loads)
    const sessionChecked = typeof window !== 'undefined' 
      ? sessionStorage.getItem('topup_bonus_session_checked') === currentUserId
      : false

    // Detect if this is a new sign-in:
    // 1. No stored previous user ID and we have a current user (first time in session)
    // 2. Stored previous user ID is different from current user ID (user switched accounts)
    const isNewSignIn = (!storedPreviousUserId && currentUserId) || 
                        (storedPreviousUserId !== null && storedPreviousUserId !== currentUserId)

    // If we've already checked in this session for this user, don't check again (prevents showing on every page load)
    if (sessionChecked && storedPreviousUserId === currentUserId) {
      prevUserRef.current = currentUserId
      // Update stored user ID if not set
      if (typeof window !== 'undefined' && !storedPreviousUserId) {
        sessionStorage.setItem('topup_bonus_previous_user_id', currentUserId)
      }
      return
    }

    // On new sign-in, always check (cooldown doesn't apply)
    if (isNewSignIn) {
      prevUserRef.current = currentUserId
      hasCheckedRef.current = false
      // Clear session check and update stored user ID so it shows on new sign-in
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('topup_bonus_session_checked')
        sessionStorage.setItem('topup_bonus_previous_user_id', currentUserId)
      }
      const timeoutId = setTimeout(() => {
        checkBonusEligibility(true) // Pass true to indicate new sign-in
      }, 500)
      return () => {
        clearTimeout(timeoutId)
      }
    }

    // Update ref and stored user ID
    prevUserRef.current = currentUserId
    if (typeof window !== 'undefined' && storedPreviousUserId !== currentUserId) {
      sessionStorage.setItem('topup_bonus_previous_user_id', currentUserId)
    }

    // Only check once when user becomes available (first time in this session)
    if (hasCheckedRef.current && previousUserId === currentUserId) {
      return
    }
    // Check once after a short delay to ensure everything is ready
    const timeoutId = setTimeout(() => {
      checkBonusEligibility(false) // Normal check with cooldown
    }, 500)
    
    return () => {
      clearTimeout(timeoutId)
    }
  }, [mounted, user, checkBonusEligibility])


  // Don't render anything until mounted to avoid hydration issues
  if (!mounted) {
    return null
  }

  return (
    <TopUpBonusDialog
      open={showDialog}
      onOpenChange={(open) => {
        setShowDialog(open)
        // Store timestamp when dialog is closed (user dismissed it) - use sessionStorage
        if (!open && user && typeof window !== 'undefined') {
          const storageKey = `topup_bonus_last_shown_${user.id}`
          sessionStorage.setItem(storageKey, Date.now().toString())
        }
      }}
      bonusPoints={bonusPoints}
      bonusEndTime={bonusEndTime}
    />
  )
}

