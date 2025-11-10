"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"
import { useOnlineStatus } from "@/components/online-status-provider"

interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  userId?: string
  isOnline?: boolean
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, userId, isOnline, children, ...props }, ref) => {
  const { isUserOnline } = useOnlineStatus()
  const showOnlineIndicator = isOnline !== undefined 
    ? isOnline 
    : userId ? isUserOnline(userId) : false

  return (
    <div className={cn(
      showOnlineIndicator ? "avatar-online-ripple" : "relative inline-block"
    )}>
      <AvatarPrimitive.Root
        ref={ref}
        className={cn(
          "relative flex h-10 w-10 shrink-0 rounded-full transition-all duration-200 z-10",
          "overflow-hidden",
          showOnlineIndicator
            ? ""
            : "border border-white/20 hover:border-white/40",
          className
        )}
        {...props}
      >
        {children}
      </AvatarPrimitive.Root>
    </div>
  )
})
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover rounded-full", className)}
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
      "flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground backdrop-blur-md",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
