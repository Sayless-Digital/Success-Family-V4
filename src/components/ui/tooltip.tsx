"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Info } from "lucide-react"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 8, style, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-[400002] rounded-lg border border-white/20 bg-black/70 px-3 py-2 text-xs text-white/85 shadow-lg",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-top-1/2",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-1/2",
      className,
    )}
    style={{
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      backgroundColor: "rgba(12, 12, 18, 0.75)",
      borderColor: "rgba(255, 255, 255, 0.22)",
      boxShadow: "0 18px 45px rgba(10, 12, 24, 0.55)",
      ...style,
    }}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

type InfoTooltipProps = {
  content: React.ReactNode
  ariaLabel?: string
  side?: TooltipPrimitive.TooltipContentProps["side"]
  align?: TooltipPrimitive.TooltipContentProps["align"]
  className?: string
  triggerClassName?: string
  iconClassName?: string
  children?: React.ReactElement
}

const TOUCH_POINTERS = new Set<PointerEvent["pointerType"]>(["touch", "pen"])

function InfoTooltip({
  content,
  ariaLabel = "More information",
  side = "bottom",
  align = "center",
  className,
  triggerClassName,
  iconClassName,
  children,
}: InfoTooltipProps) {
  const [open, setOpen] = React.useState(false)
  const isTouchInteraction = React.useRef(false)

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (TOUCH_POINTERS.has(event.pointerType)) {
        isTouchInteraction.current = true
        event.preventDefault()
        event.stopPropagation()
        setOpen((previous) => {
          const next = !previous
          if (!next) {
            isTouchInteraction.current = false
          }
          return next
        })
      }
    },
    [],
  )

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (isTouchInteraction.current) {
      return
    }
    setOpen(nextOpen)
  }, [])

  React.useEffect(() => {
    if (!isTouchInteraction.current) return
    if (!open) return

    const closeAndReset = () => {
      setOpen(false)
      isTouchInteraction.current = false
    }

    const closeOnScroll = () => closeAndReset()
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      const tooltip = document.querySelector("[data-radix-tooltip-content]")
      if (tooltip && tooltip.contains(event.target)) return
      closeAndReset()
    }

    window.addEventListener("scroll", closeOnScroll, true)
    window.addEventListener("pointerdown", closeOnPointerDown, true)

    return () => {
      window.removeEventListener("scroll", closeOnScroll, true)
      window.removeEventListener("pointerdown", closeOnPointerDown, true)
    }
  }, [open])

  return (
    <Tooltip open={open} onOpenChange={handleOpenChange} delayDuration={150} defaultOpen={false}>
      <TooltipTrigger
        asChild
        onPointerDown={handlePointerDown}
        onPointerUp={(event) => {
          if (!TOUCH_POINTERS.has(event.pointerType)) {
            isTouchInteraction.current = false
          }
        }}
        onPointerLeave={(event) => {
          if (!TOUCH_POINTERS.has(event.pointerType)) {
            setOpen(false)
          }
        }}
        tabIndex={-1}
      >
        {children ?? (
          <button
            type="button"
            aria-label={ariaLabel}
            className={cn("text-white/70 transition hover:text-white focus:outline-none", triggerClassName)}
          >
            <Info className={cn("h-4 w-4", iconClassName)} />
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        avoidCollisions
        collisionPadding={12}
        className={cn("max-w-xs text-center", className)}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  )
}

export {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  InfoTooltip,
}
