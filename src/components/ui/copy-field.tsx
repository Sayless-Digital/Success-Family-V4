"use client"

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'

interface CopyFieldProps {
  label: string
  value: string
  className?: string
}

export function CopyField({ label, value, className }: CopyFieldProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    if (!value) return
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
      <div className="text-xs font-medium text-white/60 mb-1.5 uppercase tracking-wide">{label}</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 truncate text-white/90 text-sm font-medium">{value || '—'}</div>
        <Button 
          type="button" 
          onClick={handleCopy} 
          disabled={!value}
          size="icon"
          className="bg-white/10 text-white/70 hover:bg-white/20 hover:text-white/90 h-8 w-8 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}


