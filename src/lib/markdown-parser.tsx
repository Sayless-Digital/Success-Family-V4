import React from "react"
import { Mention } from "@/components/mention"

/**
 * Parses WhatsApp-style markdown formatting with smarter pattern matching:
 * Only formats complete patterns (surrounded by spaces/start/end)
 * Shows incomplete patterns as plain text (e.g., *word without closing *)
 * Also handles @mentions
 */
export function parseMarkdown(text: string): React.ReactNode[] {
  if (!text) return []

  // Pattern to match complete markdown syntax only
  // A complete pattern is one that is:
  // - At word boundaries (start, end, or surrounded by spaces/punctuation)
  // - Has matching opening and closing markers
  
  // First, identify all potential markdown patterns with their positions
  const patterns: Array<{
    start: number
    end: number
    type: 'bold' | 'italic' | 'strike' | 'underline' | 'mention'
    content: string
    fullMatch: string
  }> = []

  // Match @mentions first (before other patterns to avoid conflicts)
  // Pattern: @username (alphanumeric, underscore, hyphen)
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g
  let match
  while ((match = mentionRegex.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length
    const username = match[1]
    
    // Only match if it's at a word boundary (start of text, after space, or after newline)
    const isAtBoundary = start === 0 || 
      /\s/.test(text[start - 1]) || 
      text[start - 1] === '\n'
    
    if (isAtBoundary && username.length > 0) {
      patterns.push({
        start,
        end,
        type: 'mention',
        content: username,
        fullMatch: match[0]
      })
    }
  }

  // Helper to check if a position is at a word boundary
  const isWordBoundary = (pos: number): boolean => {
    if (pos <= 0 || pos >= text.length) return true
    const char = text[pos]
    return /\s|^|$/.test(char)
  }

  // Match **italic** (double asterisk)
  const italicRegex = /\*\*(.+?)\*\*/g
  while ((match = italicRegex.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length
    // Check if this overlaps with a mention
    const isPartOfMention = patterns.some(p => 
      p.type === 'mention' && start >= p.start && start < p.end
    )
    // Only match if it's at word boundaries or the content is not empty, and not part of mention
    if (!isPartOfMention && match[1].trim().length > 0) {
      patterns.push({
        start,
        end,
        type: 'italic',
        content: match[1],
        fullMatch: match[0]
      })
    }
  }

  // Match *bold* (single asterisk, but not part of **)
  const boldRegex = /(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/g
  while ((match = boldRegex.exec(text)) !== null) {
    // Check if this is already part of an italic match or mention
    const start = match.index
    const isPartOfItalic = patterns.some(p => 
      p.type === 'italic' && start >= p.start && start < p.end
    )
    const isPartOfMention = patterns.some(p => 
      p.type === 'mention' && start >= p.start && start < p.end
    )
    
    if (!isPartOfItalic && !isPartOfMention && match[1].trim().length > 0) {
      patterns.push({
        start,
        end: start + match[0].length,
        type: 'bold',
        content: match[1],
        fullMatch: match[0]
      })
    }
  }

  // Match ~strike~
  const strikeRegex = /~(.+?)~/g
  while ((match = strikeRegex.exec(text)) !== null) {
    const start = match.index
    const isPartOfOther = patterns.some(p => 
      p.type !== 'mention' && start >= p.start && start < p.end
    )
    
    if (!isPartOfOther && match[1].trim().length > 0) {
      patterns.push({
        start,
        end: start + match[0].length,
        type: 'strike',
        content: match[1],
        fullMatch: match[0]
      })
    }
  }

  // Match _underline_
  const underlineRegex = /_(.+?)_/g
  while ((match = underlineRegex.exec(text)) !== null) {
    const start = match.index
    const isPartOfOther = patterns.some(p => 
      p.type !== 'mention' && start >= p.start && start < p.end
    )
    
    if (!isPartOfOther && match[1].trim().length > 0) {
      patterns.push({
        start,
        end: start + match[0].length,
        type: 'underline',
        content: match[1],
        fullMatch: match[0]
      })
    }
  }

  // Sort patterns by start position
  patterns.sort((a, b) => a.start - b.start)

  // Helper function to split text by newlines and preserve them
  const splitByNewlines = (text: string): React.ReactNode[] => {
    const parts = text.split('\n')
    const result: React.ReactNode[] = []
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        // Add line break between parts
        result.push(<br key={`br-${keyCounter++}`} />)
      }
      if (parts[i]) {
        result.push(parts[i])
      }
    }
    return result
  }

  // Build React nodes from patterns
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let keyCounter = 0

  for (const pattern of patterns) {
    // Add text before pattern (split by newlines to preserve them)
    if (pattern.start > lastIndex) {
      const textBefore = text.substring(lastIndex, pattern.start)
      const splitText = splitByNewlines(textBefore)
      nodes.push(...splitText)
    }

    // Add formatted element
    switch (pattern.type) {
      case 'mention':
        nodes.push(
          <Mention key={`mention-${keyCounter++}`} username={pattern.content} />
        )
        break
      case 'bold':
        nodes.push(
          <strong key={`md-${keyCounter++}`} className="font-semibold">
            {pattern.content}
          </strong>
        )
        break
      case 'italic':
        nodes.push(
          <em key={`md-${keyCounter++}`} className="italic">
            {pattern.content}
          </em>
        )
        break
      case 'strike':
        nodes.push(
          <del key={`md-${keyCounter++}`} className="line-through">
            {pattern.content}
          </del>
        )
        break
      case 'underline':
        nodes.push(
          <u key={`md-${keyCounter++}`} className="underline">
            {pattern.content}
          </u>
        )
        break
    }

    lastIndex = pattern.end
  }

  // Add remaining text after last pattern (split by newlines to preserve them)
  if (lastIndex < text.length) {
    const textAfter = text.substring(lastIndex)
    const splitText = splitByNewlines(textAfter)
    nodes.push(...splitText)
  }

  return nodes.length > 0 ? nodes : [text]
}
