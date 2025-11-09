"use client"

import { useAuth } from "@/components/auth-provider"
import { useMemo } from "react"

/**
 * Hook to check if user needs to top up before performing certain actions
 * Returns true if:
 * - User has a due date that is in the past (overdue)
 * - User has never topped up (no due date set)
 */
export function useTopupCheck() {
  const { user, nextTopupDueOn, walletBalance } = useAuth()

  const needsTopup = useMemo(() => {
    if (!user) return false

    // If no due date is set, user has never topped up
    if (!nextTopupDueOn) {
      return true
    }

    // Check if due date is in the past
    const dueDate = new Date(nextTopupDueOn)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    dueDate.setHours(0, 0, 0, 0)

    return dueDate < today
  }, [user, nextTopupDueOn])

  const topupMessage = useMemo(() => {
    if (!needsTopup) return null

    if (!nextTopupDueOn) {
      return "Please complete your first top-up to access this feature."
    }

    return "Your account requires a top-up. Please top up to continue."
  }, [needsTopup, nextTopupDueOn])

  return {
    needsTopup,
    topupMessage,
    hasUser: !!user,
    nextTopupDueOn,
    walletBalance
  }
}