"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"
import { useOnlineStatus } from "@/components/online-status-provider"
import { Skeleton } from "@/components/ui/skeleton"

interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  userId?: string
  isOnline?: boolean
  loading?: boolean
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, userId, isOnline, loading, children, ...props }, ref) => {
  const { isUserOnline } = useOnlineStatus()
  const showOnlineIndicator = isOnline !== undefined 
    ? isOnline 
    : userId ? isUserOnline(userId) : false

  // Extract size from className to enforce square dimensions via inline styles
  const classStr = className || ''
  let explicitSize: number | undefined
  
  if (classStr.includes('h-24') && classStr.includes('w-24')) {
    explicitSize = 96 // 6rem = 96px
  } else if (classStr.includes('h-10') && classStr.includes('w-10')) {
    explicitSize = 40 // 2.5rem = 40px
  } else if (classStr.includes('h-16') && classStr.includes('w-16')) {
    explicitSize = 64 // 4rem = 64px
  } else if (classStr.includes('h-8') && classStr.includes('w-8')) {
    explicitSize = 32 // 2rem = 32px
  }

  // If loading, show skeleton
  if (loading) {
    const skeletonElement = (
      <Skeleton 
        className={cn(
          "rounded-full shrink-0",
          className
        )}
        style={{
          aspectRatio: "1 / 1",
          ...(explicitSize ? {
            width: `${explicitSize}px`,
            height: `${explicitSize}px`,
            minWidth: `${explicitSize}px`,
            maxWidth: `${explicitSize}px`,
            minHeight: `${explicitSize}px`,
            maxHeight: `${explicitSize}px`,
          } : {}),
        }}
      />
    )
    
    // Wrap skeleton in online ripple div if needed for consistency
    if (showOnlineIndicator) {
      return (
        <div className="avatar-online-ripple">
          {skeletonElement}
        </div>
      )
    }
    
    return skeletonElement
  }

  const avatarRoot = (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative inline-block align-middle shrink-0 rounded-full transition-all duration-200 z-10",
        "overflow-hidden box-border avatar-enforce-square",
        showOnlineIndicator
          ? ""
          : "border border-white/20 hover:border-white/40",
        className
      )}
      style={{
        aspectRatio: "1 / 1",
        ...(explicitSize ? {
          width: `${explicitSize}px`,
          height: `${explicitSize}px`,
          minWidth: `${explicitSize}px`,
          maxWidth: `${explicitSize}px`,
          minHeight: `${explicitSize}px`,
          maxHeight: `${explicitSize}px`,
        } : {}),
        ...props.style,
      }}
      {...props}
    >
      {children}
    </AvatarPrimitive.Root>
  )

  // Only wrap in div when online indicator is needed (for ripple effect)
  if (showOnlineIndicator) {
    return (
      <div className="avatar-online-ripple">
        {avatarRoot}
      </div>
    )
  }

  // No wrapper needed when no online indicator - render directly
  return avatarRoot
})
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn(
      "absolute inset-0 h-full w-full object-cover object-center rounded-full",
      className
    )}
    style={{
      transformOrigin: 'center center',
      ...props.style,
    }}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "absolute inset-0 flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground backdrop-blur-md",
      className
    )}
    style={{
      transformOrigin: 'center center',
      ...props.style,
    }}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
