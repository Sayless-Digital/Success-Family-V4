"use client"

import * as React from 'react'
import { Button } from '@/components/ui/button'

interface CopyFieldProps {
  label: string
  value: string
  className?: string
}

export function CopyField({ label, value, className }: CopyFieldProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // ignore
    }
  }

  return (
    <div className={className}>
      <div className="text-xs text-white/60 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 truncate text-white/80 text-sm">{value}</div>
        <Button type="button" onClick={handleCopy} className="bg-white/10 text-white/80 hover:bg-white/20 h-8 px-2">
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}


