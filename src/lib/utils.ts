import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface FormatRelativeTimeOptions {
  now?: Date | string | number
}

export function formatRelativeTime(
  input: string | Date | null | undefined,
  options: FormatRelativeTimeOptions = {}
): string {
  if (!input) {
    return ""
  }

  const date = typeof input === "string" || typeof input === "number" ? new Date(input) : input
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const reference =
    options.now instanceof Date
      ? options.now
      : options.now !== undefined
        ? new Date(options.now)
        : new Date()

  const diffMs = reference.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`

  return date.toLocaleDateString()
}
