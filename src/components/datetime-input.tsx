"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface DateTimeInputProps extends React.ComponentProps<"input"> {
  defaultValue?: string
}

export function DateTimeInput({ className, onClick, ...props }: DateTimeInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    // Ensure the input is properly set up for datetime-local
    if (inputRef.current) {
      // Force the input to be interactive
      inputRef.current.style.pointerEvents = 'auto'
      inputRef.current.style.cursor = 'pointer'
      inputRef.current.style.position = 'relative'
      inputRef.current.style.zIndex = '10'
    }
  }, [])

  const handleClick = React.useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    // Focus the input to open the picker
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.showPicker?.()
    }
    onClick?.(e)
  }, [onClick])

  return (
    <Input
      ref={inputRef}
      type="datetime-local"
      className={cn("relative z-10 cursor-pointer", className)}
      style={{ pointerEvents: 'auto' }}
      onClick={handleClick}
      {...props}
    />
  )
}

