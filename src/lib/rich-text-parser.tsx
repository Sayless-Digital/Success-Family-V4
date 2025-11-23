import React from "react"
import Link from "next/link"

/**
 * WhatsApp-style rich text formatting:
 * - **bold** → <strong>
 * - _italic_ → <em>
 * - `monospace` → <code>
 * - ~strikethrough~ → <del>
 * - @username → Link to profile
 * - URLs → Clickable links
 */

export interface RichTextSegment {
  type: 'text' | 'bold' | 'italic' | 'code' | 'strikethrough' | 'link' | 'mention'
  content: string
  href?: string
  username?: string
}

/**
 * Extracts URLs from text
 */
export function extractUrls(text: string): string[] {
  const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/g
  const matches = text.match(urlPattern) || []
  return matches.map(url => url.startsWith('www.') ? `https://${url}` : url)
}

/**
 * Parses WhatsApp-style rich text formatting
 * Supports: **bold**, _italic_, `code`, ~strikethrough~, @mentions, URLs
 */
export function parseRichText(text: string): RichTextSegment[] {
  if (!text) return []

  const segments: RichTextSegment[] = []

  // Token regex patterns (order matters - more specific first)
  const patterns = [
    { type: 'bold' as const, regex: /\*\*(.+?)\*\*/g },
    { type: 'code' as const, regex: /`(.+?)`/g },
    { type: 'strikethrough' as const, regex: /~(.+?)~/g },
    { type: 'italic' as const, regex: /_(.+?)_/g },
    { type: 'mention' as const, regex: /@(\w+)/g },
    { type: 'link' as const, regex: /(https?:\/\/[^\s]+|www\.[^\s]+)/g },
  ]

  // Find all matches across all patterns
  const allMatches: Array<{
    type: RichTextSegment['type']
    start: number
    end: number
    content: string
    username?: string
    href?: string
  }> = []

  patterns.forEach(({ type, regex }) => {
    let match
    regex.lastIndex = 0
    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0]
      const content = match[1] || fullMatch
      const start = match.index!
      const end = start + fullMatch.length

      // For links, determine href
      let href: string | undefined
      if (type === 'link') {
        href = content.startsWith('www.') ? `https://${content}` : content
      } else if (type === 'mention') {
        href = `/profile/${content}`
      }

      allMatches.push({
        type,
        start,
        end,
        content: type === 'link' ? content : (match[1] || content),
        username: type === 'mention' ? content : undefined,
        href,
      })
    }
  })

  // Sort matches by start position
  allMatches.sort((a, b) => a.start - b.start)

  // Remove overlapping matches (keep first one)
  const nonOverlapping: typeof allMatches = []
  for (const match of allMatches) {
    const overlaps = nonOverlapping.some(
      existing => 
        (match.start >= existing.start && match.start < existing.end) ||
        (match.end > existing.start && match.end <= existing.end) ||
        (match.start <= existing.start && match.end >= existing.end)
    )
    if (!overlaps) {
      nonOverlapping.push(match)
    }
  }

  // Build segments
  let lastIndex = 0
  nonOverlapping.forEach(match => {
    // Add text before this match
    if (match.start > lastIndex) {
      const beforeText = text.substring(lastIndex, match.start)
      if (beforeText) {
        segments.push({ type: 'text', content: beforeText })
      }
    }

    // Add the formatted segment
    segments.push({
      type: match.type,
      content: match.content,
      username: match.username,
      href: match.href,
    })

    lastIndex = match.end
  })

  // Add remaining text
  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex)
    if (remaining) {
      segments.push({ type: 'text', content: remaining })
    }
  }

  // If no formatting found, return as single text segment
  return segments.length > 0 ? segments : [{ type: 'text', content: text }]
}

/**
 * Renders rich text segments as React elements
 */
export function renderRichText(segments: RichTextSegment[]): React.ReactNode[] {
  return segments.map((segment, index) => {
    switch (segment.type) {
      case 'bold':
        return (
          <strong key={index} className="font-semibold">
            {segment.content}
          </strong>
        )
      case 'italic':
        return (
          <em key={index} className="italic">
            {segment.content}
          </em>
        )
      case 'code':
        return (
          <code
            key={index}
            className="px-1 py-0.5 rounded bg-white/10 text-white/90 font-mono text-sm"
          >
            {segment.content}
          </code>
        )
      case 'strikethrough':
        return (
          <del key={index} className="line-through opacity-70">
            {segment.content}
          </del>
        )
      case 'link':
        return (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-300 hover:text-sky-200 underline break-all transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {segment.content}
          </a>
        )
      case 'mention':
        return (
          <Link
            key={index}
            href={segment.href || `/profile/${segment.username}`}
            className="text-sky-300 hover:text-sky-200 font-medium transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            @{segment.username}
          </Link>
        )
      default:
        return <React.Fragment key={index}>{segment.content}</React.Fragment>
    }
  })
}

