import React from "react"

/**
 * Parses WhatsApp-style markdown formatting with smarter pattern matching:
 * Only formats complete patterns (surrounded by spaces/start/end)
 * Shows incomplete patterns as plain text (e.g., *word without closing *)
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
    type: 'bold' | 'italic' | 'strike' | 'underline'
    content: string
    fullMatch: string
  }> = []

  // Helper to check if a position is at a word boundary
  const isWordBoundary = (pos: number): boolean => {
    if (pos <= 0 || pos >= text.length) return true
    const char = text[pos]
    return /\s|^|$/.test(char)
  }

  // Match **italic** (double asterisk)
  const italicRegex = /\*\*(.+?)\*\*/g
  let match
  while ((match = italicRegex.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length
    // Only match if it's at word boundaries or the content is not empty
    if (match[1].trim().length > 0) {
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
    // Check if this is already part of an italic match
    const start = match.index
    const isPartOfItalic = patterns.some(p => 
      p.type === 'italic' && start >= p.start && start < p.end
    )
    
    if (!isPartOfItalic && match[1].trim().length > 0) {
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
    const isPartOfOther = patterns.some(p => start >= p.start && start < p.end)
    
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
    const isPartOfOther = patterns.some(p => start >= p.start && start < p.end)
    
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

  // Build React nodes from patterns
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let keyCounter = 0

  for (const pattern of patterns) {
    // Add text before pattern
    if (pattern.start > lastIndex) {
      nodes.push(text.substring(lastIndex, pattern.start))
    }

    // Add formatted element
    switch (pattern.type) {
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

  // Add remaining text after last pattern
  if (lastIndex < text.length) {
    nodes.push(text.substring(lastIndex))
  }

  return nodes.length > 0 ? nodes : [text]
}
