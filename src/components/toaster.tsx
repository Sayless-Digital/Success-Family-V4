"use client"

import { Toaster as Sonner } from "sonner"
import { createPortal } from 'react-dom'
import { useEffect, useState } from "react"

type ToasterProps = React.ComponentProps<typeof Sonner>

export function Toaster({ ...props }: ToasterProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Inject style tag to ensure close button positioning overrides Sonner's defaults
    const style = document.createElement('style')
    style.textContent = `
      [data-sonner-toast] [data-close-button],
      [data-sonner-toast][data-styled='true'] [data-close-button] {
        position: absolute !important;
        left: auto !important;
        right: 0.375rem !important;
        top: 0.5rem !important;
        bottom: auto !important;
        transform: none !important;
        background: rgba(255, 255, 255, 0.1) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        box-shadow: none !important;
        width: 1.25rem !important;
        height: 1.25rem !important;
      }
      [data-sonner-toast] [data-close-button] svg,
      [data-sonner-toast][data-styled='true'] [data-close-button] svg {
        width: 0.875rem !important;
        height: 0.875rem !important;
      }
    `
    document.head.appendChild(style)
    
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  // Render the Sonner Toaster within a portal to ensure it's in the top layer
  if (!mounted) return null

  return createPortal(
    <>
      <Sonner
        {...props}
        closeButton
        toastOptions={{
          ...props.toastOptions,
          classNames: {
            ...props.toastOptions?.classNames,
            toast: "pr-12",
            closeButton: "absolute right-1.5 top-2 bg-white/10 border border-white/20",
          },
          style: {
            paddingRight: "3rem",
            ...props.toastOptions?.style,
          },
        }}
        style={{
          zIndex: 2147483647,
        }}
      />
    </>,
    document.body
  )
}

