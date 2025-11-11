"use client"

import { cn } from "@/lib/utils"

type PlatformLogoSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl"

const SIZE_STYLES: Record<
  PlatformLogoSize,
  {
    container: string
    outerRing: string
    innerRing: string
  }
> = {
  xs: {
    container: "h-6 w-6",
    outerRing: "h-6 w-6",
    innerRing: "h-4 w-4",
  },
  sm: {
    container: "h-8 w-8",
    outerRing: "h-8 w-8",
    innerRing: "h-5 w-5",
  },
  md: {
    container: "h-10 w-10",
    outerRing: "h-10 w-10",
    innerRing: "h-6 w-6",
  },
  lg: {
    container: "h-12 w-12",
    outerRing: "h-12 w-12",
    innerRing: "h-7 w-7",
  },
  xl: {
    container: "h-16 w-16",
    outerRing: "h-16 w-16",
    innerRing: "h-10 w-10",
  },
  "2xl": {
    container: "h-20 w-20",
    outerRing: "h-20 w-20",
    innerRing: "h-12 w-12",
  },
}

const DEFAULT_SIZE: PlatformLogoSize = "md"

interface PlatformLogoProps {
  size?: PlatformLogoSize
  className?: string
}

export function PlatformLogo({
  size = DEFAULT_SIZE,
  className,
}: PlatformLogoProps) {
  const sizeStyles = SIZE_STYLES[size] || SIZE_STYLES[DEFAULT_SIZE]
  
  // Adjust border width based on size
  const outerBorderWidth = size === "xs" ? "border-[3px]" : size === "sm" ? "border-[3px]" : "border-[4px]"
  // Inner ring: thinner for small sizes, thicker for desktop/larger sizes
  const innerBorderWidth = size === "xs" ? "border-[1.5px]" : size === "sm" ? "border-2" : "border-[2.5px]"

  return (
    <div
      className={cn(
        "relative flex items-center justify-center",
        sizeStyles.container,
        className
      )}
    >
      {/* Outer ring - thicker white ring, 90% opacity */}
      <div
        className={cn(
          "absolute rounded-full border-white/90 shadow-lg",
          outerBorderWidth,
          sizeStyles.outerRing
        )}
      />
      
      {/* Inner ring - white ring, 70% opacity, thicker on desktop */}
      <div
        className={cn(
          "absolute rounded-full border-white/70",
          innerBorderWidth,
          // Make inner ring slightly thicker on desktop for better visibility
          size === "xs" && "md:border-[2px]",
          size === "sm" && "md:border-[2.5px]",
          (size === "md" || size === "lg" || size === "xl" || size === "2xl") && "md:border-[3px]",
          sizeStyles.innerRing
        )}
      />
    </div>
  )
}
