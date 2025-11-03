"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { useEffect, useRef } from "react"
import { OverlayScrollbars } from 'overlayscrollbars'
import 'overlayscrollbars/overlayscrollbars.css'

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

interface BaseDialogContentProps 
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  scrollbarClassName?: string
  contentClassName?: string
}

const BaseDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  BaseDialogContentProps
>(({ className, children, scrollbarClassName, contentClassName, ...props }, ref) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollbarInstanceRef = useRef<OverlayScrollbars | null>(null)

  // Initialize OverlayScrollbars when component mounts
  useEffect(() => {
    if (!contentRef.current) return

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (contentRef.current && !scrollbarInstanceRef.current) {
        scrollbarInstanceRef.current = OverlayScrollbars(contentRef.current, {
          scrollbars: {
            theme: 'custom-overlay',
            visibility: 'auto',
            autoHide: 'move',
            autoHideDelay: 200,
            dragScroll: true,
            clickScroll: false,
          },
          overflow: {
            x: 'hidden',
            y: 'scroll',
          },
          paddingAbsolute: false,
          showNativeOverlaidScrollbars: false,
        })
      }
    }, 0)

    return () => {
      clearTimeout(timer)
      if (scrollbarInstanceRef.current) {
        scrollbarInstanceRef.current.destroy()
        scrollbarInstanceRef.current = null
      }
    }
  }, [])

  // Update scrollbar instance when content changes or dialog state changes
  useEffect(() => {
    if (scrollbarInstanceRef.current) {
      // Small delay to ensure DOM updates are complete
      const timer = setTimeout(() => {
        scrollbarInstanceRef.current?.update()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [children])

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-50 border border-white/20 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md shadow-lg duration-200 rounded-lg",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          // Mobile: 8px from all edges (0.5rem = 8px)
          "top-2 left-2 right-2 bottom-2",
          "w-[calc(100vw-1rem)] h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)]",
          // Desktop: centered with max-width
          "sm:left-[50%] sm:top-[50%] sm:right-auto sm:bottom-auto",
          "sm:w-full sm:max-w-lg",
          "sm:translate-x-[-50%] sm:translate-y-[-50%]",
          "sm:h-auto sm:max-h-[calc(100dvh-4rem)] sm:min-h-0",
          "overflow-hidden flex flex-col",
          "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          className
        )}
        {...props}
      >
        <div ref={contentRef} className={cn("flex-1 min-h-0 overflow-auto", scrollbarClassName)}>
          <div className={cn("p-6", contentClassName)}>
            {children}
          </div>
        </div>
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 text-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-white/20 data-[state=open]:text-white cursor-pointer">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
BaseDialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-center sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-white",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-white/80", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  BaseDialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}

