"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
  const isWhite = className?.includes('slider-white')
  
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        "touch-action-none",
        className
      )}
      style={{
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      {...props}
    >
      <SliderPrimitive.Track className={cn(
        "relative h-2 w-full grow rounded-full cursor-pointer",
        isWhite ? "bg-white/20 overflow-visible" : "bg-secondary overflow-hidden"
      )}>
        <SliderPrimitive.Range className={cn(
          "absolute h-full",
          isWhite ? "bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.6),0_0_16px_rgba(255,255,255,0.4)]" : "bg-primary"
        )} />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className={cn(
        "block h-5 w-5 rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer touch-action-none",
        isWhite 
          ? "bg-white border-white ring-offset-transparent focus-visible:ring-white/30 shadow-[0_0_8px_rgba(255,255,255,0.6),0_0_16px_rgba(255,255,255,0.4),0_0_24px_rgba(255,255,255,0.2)] [&:not(:active)]:hover:shadow-[0_0_12px_rgba(255,255,255,0.8),0_0_24px_rgba(255,255,255,0.5),0_0_32px_rgba(255,255,255,0.3)]"
          : "border-primary bg-background ring-offset-background focus-visible:ring-ring [&:not(:active)]:transition-colors"
      )} />
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
