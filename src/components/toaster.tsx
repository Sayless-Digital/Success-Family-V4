"use client"

import { Toaster as Sonner } from "sonner"
import { createPortal } from 'react-dom'
import { useEffect, useState } from "react"

type ToasterProps = React.ComponentProps<typeof Sonner>

export function Toaster({ ...props }: ToasterProps) {
  const [mounted, setMounted] = useState(false)
  const [container, setContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setMounted(true)
    
    // Create a dedicated container for toasts with highest z-index
    // This ensures toasts appear above dialogs (which use z-index 2147483647)
    const toastContainer = document.createElement('div')
    toastContainer.setAttribute('data-sonner-toaster-container', 'true')
    toastContainer.style.position = 'fixed'
    toastContainer.style.top = '0'
    toastContainer.style.left = '0'
    toastContainer.style.right = '0'
    toastContainer.style.bottom = '0'
    toastContainer.style.pointerEvents = 'none'
    toastContainer.style.zIndex = '2147483647'
    document.body.appendChild(toastContainer)
    setContainer(toastContainer)
    
    // Inject style tag to ensure close button positioning and toast z-index
    const style = document.createElement('style')
    style.setAttribute('data-sonner-toaster-styles', 'true')
    style.textContent = `
      /* Allow pointer events on toasts themselves */
      [data-sonner-toaster-container] [data-sonner-toaster],
      [data-sonner-toaster-container] [data-sonner-toast] {
        pointer-events: auto !important;
      }
      /* Close button positioning overrides Sonner's defaults */
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
      /* Ensure toasts appear above dialogs (dialogs use z-index 2147483647) */
      [data-sonner-toaster] {
        z-index: 2147483647 !important;
        position: fixed !important;
      }
      [data-sonner-toast] {
        z-index: 2147483647 !important;
      }
    `
    document.head.appendChild(style)
    
    return () => {
      if (style && document.head.contains(style)) {
        document.head.removeChild(style)
      }
      if (toastContainer && document.body.contains(toastContainer)) {
        document.body.removeChild(toastContainer)
      }
    }
  }, [])

  // Render the Sonner Toaster within a portal to ensure it's in the top layer
  if (!mounted || !container) return null

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
    container
  )
}

