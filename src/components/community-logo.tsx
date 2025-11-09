"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

type CommunityLogoSize = "sm" | "md" | "lg" | "xl" | "2xl"

const SIZE_STYLES: Record<
  CommunityLogoSize,
  {
    avatar: string
    fallback: string
  }
> = {
  sm: {
    avatar: "h-8 w-8",
    fallback: "text-sm",
  },
  md: {
    avatar: "h-10 w-10",
    fallback: "text-base",
  },
  lg: {
    avatar: "h-12 w-12",
    fallback: "text-lg",
  },
  xl: {
    avatar: "h-16 w-16",
    fallback: "text-xl",
  },
  "2xl": {
    avatar: "h-20 w-20",
    fallback: "text-2xl",
  },
}

const DEFAULT_SIZE: CommunityLogoSize = "md"

function getCommunityInitials(name?: string | null) {
  if (!name) return "SF"

  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return "SF"

  const initials = words
    .slice(0, 2)
    .map((word) => word[0] || "")
    .join("")

  return (initials || name.slice(0, 2) || "SF").toUpperCase()
}

interface CommunityLogoProps {
  name: string
  logoUrl?: string | null
  size?: CommunityLogoSize
  className?: string
  fallbackClassName?: string
  imageClassName?: string
  alt?: string
}

export function CommunityLogo({
  name,
  logoUrl,
  size = DEFAULT_SIZE,
  className,
  fallbackClassName,
  imageClassName,
  alt,
}: CommunityLogoProps) {
  const sizeStyles = SIZE_STYLES[size] || SIZE_STYLES[DEFAULT_SIZE]
  const initials = getCommunityInitials(name)

  return (
    <Avatar
      className={cn(
        "bg-white/10 shadow-lg backdrop-blur-md border-white/20",
        sizeStyles.avatar,
        className,
      )}
    >
      {logoUrl ? (
        <AvatarImage
          src={logoUrl}
          alt={alt ?? `${name} logo`}
          className={cn("object-cover", imageClassName)}
        />
      ) : null}
      <AvatarFallback
        className={cn(
          "font-semibold uppercase tracking-tight text-primary-foreground",
          sizeStyles.fallback,
          fallbackClassName,
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}

export { getCommunityInitials }

