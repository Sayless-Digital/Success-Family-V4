"use client"

import { Toaster as Sonner } from "sonner"
import { createPortal } from 'react-dom'
import { useEffect, useState } from "react"

type ToasterProps = React.ComponentProps<typeof Sonner>

export function Toaster({ ...props }: ToasterProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Render the Sonner Toaster within a portal to ensure it's in the top layer
  if (!mounted) return null

  return createPortal(
    <Sonner
      {...props}
      style={{
        zIndex: 2147483647,
      }}
    />,
    document.body
  )
}

