"use client"

import * as React from 'react'
import { toast } from 'sonner'

export function WalletSuccessToast() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const success = url.searchParams.get('success')
    if (success === 'receipt-submitted') {
      toast.success('Receipt submitted! We will verify it shortly.')
      url.searchParams.delete('success')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  return null
}


