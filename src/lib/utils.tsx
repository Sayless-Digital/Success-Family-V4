import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import React from "react"

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

/**
 * Detects URLs in text and converts them to clickable links
 * Supports http://, https://, www., and email addresses
 */
export function linkifyText(text: string): React.ReactNode[] {
  if (!text) return []

  // URL pattern: matches http://, https://, www., and email addresses
  const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g

  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let matchIndex = 0

  const matches = Array.from(text.matchAll(urlPattern))

  if (matches.length === 0) {
    // No URLs found, return text as-is
    return [text]
  }

  matches.forEach((match) => {
    const url = match[0]
    const matchStart = match.index!
    const matchEnd = matchStart + url.length

    // Add text before the URL
    if (matchStart > lastIndex) {
      parts.push(text.substring(lastIndex, matchStart))
    }

    // Determine the href and display text
    let href = url
    let displayText = url

    // Add protocol if missing (www. or email)
    if (url.startsWith("www.")) {
      href = `https://${url}`
      displayText = url
    } else if (url.includes("@") && !url.startsWith("http")) {
      // Email address
      href = `mailto:${url}`
      displayText = url
    }

    // Add the link
    parts.push(
      <a
        key={`link-${matchIndex++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sky-300 hover:text-sky-200 underline break-all transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {displayText}
      </a>
    )

    lastIndex = matchEnd
  })

  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}


