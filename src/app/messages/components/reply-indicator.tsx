"use client"

import { Reply } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReplyIndicatorProps {
  isOwn: boolean
  offset: number
}

export function ReplyIndicator({ isOwn, offset }: ReplyIndicatorProps) {
  return (
    <div 
      className={cn(
        "absolute top-1/2 flex items-center justify-center w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 z-20",
        isOwn ? "-left-12" : "-right-12"
      )}
      style={{
        opacity: Math.min(offset / 60, 1),
        transform: 'translateY(-50%)',
        willChange: 'opacity',
        transition: 'opacity 0.1s ease-out'
      }}
    >
      <Reply className="h-4 w-4 text-white/80" />
    </div>
  )
}


