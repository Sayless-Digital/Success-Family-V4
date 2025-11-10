"use client"

import { useAuth } from "@/components/auth-provider"
import { useMemo } from "react"

/**
 * Hook to check if user needs to top up before performing certain actions
 * Returns true if:
 * - User has a due date that is in the past (overdue by 30 days)
 * - User has never topped up (no due date set)
 * - User has insufficient balance (less than 1 point)
 */
export function useTopupCheck() {
  const { user, userProfile, nextTopupDueOn, walletBalance, isLoading, walletDataLoaded } = useAuth()

  // Consider "checking" if auth is loading OR wallet data hasn't been loaded yet
  const isChecking = useMemo(() => {
    if (isLoading) return true
    // If user exists but wallet data hasn't been loaded yet, we're still checking
    if (user && !walletDataLoaded) return true
    return false
  }, [isLoading, user, walletDataLoaded])

  const needsTopup = useMemo(() => {
    // Don't check if auth is still loading
    if (!user || isLoading) return false

    // Platform admins are exempt from top-up requirements
    if (userProfile?.role === 'admin') {
      return false
    }

    // If wallet balance is explicitly 0 or less, user needs top-up
    if (walletBalance !== null && walletBalance < 1) {
      return true
    }

    // If no due date is set, user has never topped up (needs first top-up)
    if (nextTopupDueOn === null) {
      return true
    }

    // Check if due date is in the past (30 days overdue)
    const dueDate = new Date(nextTopupDueOn)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    dueDate.setHours(0, 0, 0, 0)

    if (dueDate < today) {
      return true
    }

    // If we get here, user has a valid due date and balance >= 1 (or balance is null but due date exists)
    // If balance is null but due date exists, it means wallet data might still be loading
    // In this case, we should allow access (don't require top-up) to avoid blocking users
    // The wallet will be created/updated when they actually perform an action
    return false
  }, [user, userProfile, nextTopupDueOn, walletBalance, isLoading])

  const topupMessage = useMemo(() => {
    if (!needsTopup) return null

    // Balance-based message
    if (walletBalance !== null && walletBalance < 1) {
      return "You need to top up to have sufficient points to access this feature."
    }

    // Date-based messages
    if (!nextTopupDueOn) {
      return "Please complete your first top-up to access this feature."
    }

    return "Your account requires a top-up. Please top up to continue."
  }, [needsTopup, nextTopupDueOn, walletBalance])

  return {
    needsTopup,
    topupMessage,
    hasUser: !!user,
    nextTopupDueOn,
    walletBalance,
    isChecking
  }
}