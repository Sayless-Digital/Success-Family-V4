"use client"

import React, { useRef, useEffect, useCallback, useState } from "react"
import { cn } from "@/lib/utils"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  minHeight?: number
  maxHeight?: number
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void | boolean
  autoResize?: boolean
  size?: "sm" | "base" | "lg"
}

/**
 * Rich text editor that shows formatted text while typing
 * Uses contenteditable with raw markdown stored separately to preserve syntax
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  minHeight = 100,
  maxHeight,
  onKeyDown,
  autoResize = true,
  size = "base",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const rawTextRef = useRef<string>(value) // Store raw markdown separately
  const isComposingRef = useRef(false)
  const isUpdatingRef = useRef(false)
  const lastCursorOffsetRef = useRef<number | null>(null)

  // Size classes
  const sizeClasses = {
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg",
  }

  // Render formatted content (markdown to HTML) - only complete patterns
  // Incomplete patterns like *word without closing * are shown as plain text
  const renderFormattedContent = useCallback((text: string): string => {
    if (!text) return ""

    // Helper to check if position is at word boundary (space, start, end, or punctuation)
    const isWordBoundary = (pos: number): boolean => {
      if (pos < 0) return true
      if (pos >= text.length) return true
      const char = text[pos]
      return /\s|[^\w*~_]/.test(char)
    }

    // Helper to check if pattern markers are properly separated
    const isValidPattern = (startPos: number, endPos: number, content: string): boolean => {
      // Must have content
      if (!content || content.trim().length === 0) return false
      
      // Check boundaries - markers should be at word boundaries or start/end of string
      const beforeStart = startPos - 1
      const afterEnd = endPos
      
      // Before start: must be start of string, space, or non-word char
      const validBefore = startPos === 0 || isWordBoundary(beforeStart) || text[beforeStart] === '\n'
      
      // After end: must be end of string, space, or non-word char  
      const validAfter = endPos >= text.length || isWordBoundary(afterEnd) || text[afterEnd] === '\n'
      
      return validBefore && validAfter
    }

    // Escape HTML first
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")

    // Track replaced ranges to avoid overlaps
    const replacedRanges: Array<{ start: number; end: number }> = []

    // Collect all valid matches first
    const matches: Array<{ start: number; end: number; html: string }> = []

    // Match **italic** first (double asterisk - takes priority)
    const italicRegex = /\*\*(.+?)\*\*/g
    let match
    while ((match = italicRegex.exec(text)) !== null) {
      const start = match.index!
      const end = start + match[0].length
      if (isValidPattern(start, end, match[1])) {
        const escaped = match[1].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        matches.push({
          start,
          end,
          html: `<em class="italic">${escaped}</em>`
        })
      }
    }

    // Match *bold* (single asterisk, not part of **)
    const boldRegex = /(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/g
    while ((match = boldRegex.exec(text)) !== null) {
      const start = match.index!
      const end = start + match[0].length
      
      // Skip if already part of italic match
      const isInItalic = matches.some(m => 
        m.html.includes('<em') && start >= m.start && start < m.end
      )
      
      if (!isInItalic && isValidPattern(start, end, match[1])) {
        const escaped = match[1].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        matches.push({
          start,
          end,
          html: `<strong class="font-semibold">${escaped}</strong>`
        })
      }
    }

    // Match ~strike~
    const strikeRegex = /~(.+?)~/g
    while ((match = strikeRegex.exec(text)) !== null) {
      const start = match.index!
      const end = start + match[0].length
      
      // Skip if already matched
      const isMatched = matches.some(m => start >= m.start && start < m.end)
      
      if (!isMatched && isValidPattern(start, end, match[1])) {
        const escaped = match[1].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        matches.push({
          start,
          end,
          html: `<del class="line-through">${escaped}</del>`
        })
      }
    }

    // Match _underline_
    const underlineRegex = /_(.+?)_/g
    while ((match = underlineRegex.exec(text)) !== null) {
      const start = match.index!
      const end = start + match[0].length
      
      // Skip if already matched
      const isMatched = matches.some(m => start >= m.start && start < m.end)
      
      if (!isMatched && isValidPattern(start, end, match[1])) {
        const escaped = match[1].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        matches.push({
          start,
          end,
          html: `<u class="underline">${escaped}</u>`
        })
      }
    }

    // Sort matches by start position (descending) to replace from end to start
    matches.sort((a, b) => b.start - a.start)

    // Replace matches from end to start to preserve positions
    for (const { start, end, html: replacement } of matches) {
      // Check for overlaps with already replaced ranges
      const hasOverlap = replacedRanges.some(r => 
        (start < r.end && end > r.start)
      )
      
      if (!hasOverlap) {
        html = html.substring(0, start) + replacement + html.substring(end)
        replacedRanges.push({ start, end })
      }
    }

    // Convert URLs to links (after markdown formatting)
    html = html.replace(/(https?:\/\/[^\s]+|www\.[^\s]+)/g, (url) => {
      const href = url.startsWith('www.') ? `https://${url}` : url
      const escapedUrl = url.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-sky-300 hover:text-sky-200 underline break-all" onclick="event.stopPropagation(); return true;">${escapedUrl}</a>`
    })

    // Preserve line breaks
    html = html.replace(/\n/g, "<br>")

    return html
  }, [])

  // Get plain text from contenteditable - need to reconstruct markdown from HTML structure
  const getTextFromEditor = (editor: HTMLDivElement): string => {
    // Reconstruct markdown from HTML structure
    let text = ""
    
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || ""
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement
        const tag = el.tagName.toLowerCase()
        
        if (tag === "br") {
          text += "\n"
        } else if (tag === "strong") {
          text += "*"
          Array.from(node.childNodes).forEach(walk)
          text += "*"
        } else if (tag === "em") {
          text += "**"
          Array.from(node.childNodes).forEach(walk)
          text += "**"
        } else if (tag === "del") {
          text += "~"
          Array.from(node.childNodes).forEach(walk)
          text += "~"
        } else if (tag === "u") {
          text += "_"
          Array.from(node.childNodes).forEach(walk)
          text += "_"
        } else if (tag === "a") {
          // For links, just get the text (not the href)
          text += el.textContent || ""
        } else {
          // For other elements, walk children
          Array.from(node.childNodes).forEach(walk)
        }
      }
    }
    
    Array.from(editor.childNodes).forEach(walk)
    return text
  }

  // Get cursor position as character offset in raw markdown text
  const getCursorOffset = (editor: HTMLDivElement): number => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return 0

    try {
      const range = selection.getRangeAt(0)
      
      // Create range from start to cursor
      const preCaretRange = document.createRange()
      preCaretRange.selectNodeContents(editor)
      preCaretRange.setEnd(range.endContainer, range.endOffset)

      // Extract text up to cursor position - this gives us markdown with syntax
      const textBefore = getTextFromEditor(editor)
      
      // The length of text before cursor is the offset
      // We need to reconstruct markdown from the HTML range
      const tempDiv = document.createElement("div")
      tempDiv.appendChild(preCaretRange.cloneContents())
      const textBeforeCursor = getTextFromEditor(tempDiv)
      
      return textBeforeCursor.length
    } catch {
      // Fallback
      return getTextFromEditor(editor).length
    }
  }

  // Set cursor position from character offset
  const setCursorOffset = (editor: HTMLDivElement, offset: number) => {
    const selection = window.getSelection()
    if (!selection) return

    try {
      const range = document.createRange()
      const walker = document.createTreeWalker(
        editor,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        null
      )

      let currentOffset = 0
      let node: Node | null = walker.nextNode()
      let targetNode: Node | null = null
      let targetOffset = 0

      while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const textLength = node.textContent?.length || 0
          if (currentOffset + textLength >= offset) {
            targetNode = node
            targetOffset = offset - currentOffset
            break
          }
          currentOffset += textLength
        } else if ((node as HTMLElement).tagName?.toLowerCase() === "br") {
          if (currentOffset === offset) {
            targetNode = node
            targetOffset = 0
            break
          }
          currentOffset += 1
        }
        node = walker.nextNode()
      }

      if (targetNode) {
        if (targetNode.nodeType === Node.TEXT_NODE) {
          range.setStart(targetNode, Math.min(targetOffset, targetNode.textContent?.length || 0))
        } else {
          range.setStartBefore(targetNode)
        }
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
      } else {
        // Fallback: end of content
        range.selectNodeContents(editor)
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
      }
    } catch {
      // Fallback: end
      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  // Update formatted HTML when raw text changes
  const updateFormattedContent = useCallback((rawText: string, preserveCursor: boolean = true) => {
    if (!editorRef.current || isUpdatingRef.current) return

    isUpdatingRef.current = true
    const editor = editorRef.current
    
    // Save cursor position as character offset in raw text before updating
    let cursorOffset = rawText.length
    if (preserveCursor) {
      try {
        const currentText = getTextFromEditor(editor)
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          const preCaretRange = document.createRange()
          preCaretRange.selectNodeContents(editor)
          preCaretRange.setEnd(range.endContainer, range.endOffset)
          
          const tempDiv = document.createElement("div")
          tempDiv.appendChild(preCaretRange.cloneContents())
          cursorOffset = getTextFromEditor(tempDiv).length
        }
      } catch (e) {
        cursorOffset = rawText.length
      }
    }
    
    lastCursorOffsetRef.current = cursorOffset

    // Render formatted HTML
    const html = renderFormattedContent(rawText)
    editor.innerHTML = html || "<br>"

    // Restore cursor position after DOM update
    requestAnimationFrame(() => {
      if (editorRef.current && lastCursorOffsetRef.current !== null) {
        const offset = Math.min(lastCursorOffsetRef.current, rawText.length)
        setCursorOffset(editorRef.current, offset)
        lastCursorOffsetRef.current = null
      }
      isUpdatingRef.current = false
    })
  }, [renderFormattedContent])

  // Format content when value changes (debounced to avoid re-rendering on every keystroke)
  useEffect(() => {
    if (!editorRef.current || isUpdatingRef.current || isComposingRef.current) return
    
    // Update raw text ref
    rawTextRef.current = value

    // Debounce the formatting update to avoid re-rendering on every keystroke
    const timer = setTimeout(() => {
      if (!editorRef.current || isUpdatingRef.current) return
      
      const currentText = getTextFromEditor(editorRef.current)
      
      // Only update if value is different (or if we need to format)
      if (value !== currentText || !isComposingRef.current) {
        updateFormattedContent(value, true)
      }
    }, 100) // 100ms debounce - format after user stops typing

    return () => clearTimeout(timer)
  }, [value, updateFormattedContent])

  // Auto-resize
  useEffect(() => {
    if (!autoResize || !editorRef.current || disabled) return

    const editor = editorRef.current
    editor.style.height = "auto"
    const scrollHeight = editor.scrollHeight
    const newHeight = Math.max(minHeight, maxHeight ? Math.min(scrollHeight, maxHeight) : scrollHeight)
    editor.style.height = `${newHeight}px`
    editor.style.overflowY = maxHeight && scrollHeight > maxHeight ? "auto" : "hidden"
  }, [value, autoResize, minHeight, maxHeight, disabled])

  // Handle input - extract text and update state
  const handleInput = useCallback(() => {
    if (disabled || !editorRef.current || isUpdatingRef.current) return

    const editor = editorRef.current
    
    // Get raw text from HTML (reconstructing markdown)
    const rawText = getTextFromEditor(editor)
    
    // Update raw text ref
    rawTextRef.current = rawText
    
    // Update parent state immediately (without formatting)
    onChange(rawText)

    // Don't re-format immediately while typing - only format after user pauses
    // This prevents cursor jumping and preserves markdown syntax
  }, [disabled, onChange])

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true
  }, [])

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false
    if (editorRef.current) {
      handleInput()
    }
  }, [handleInput])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    
    const clipboardData = e.clipboardData
    const pastedText = clipboardData.getData("text/plain")
    
    if (!editorRef.current || !pastedText) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    range.deleteContents()

    const textNode = document.createTextNode(pastedText)
    range.insertNode(textNode)
    range.setStartAfter(textNode)
    range.collapse(true)

    selection.removeAllRanges()
    selection.addRange(range)

    // Trigger input
    setTimeout(() => handleInput(), 0)
  }, [handleInput])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle custom key events
    if (onKeyDown) {
      const result = onKeyDown(e)
      if (result === false || e.defaultPrevented) {
        return
      }
    }

    // Handle Enter key
    if (e.key === "Enter" && e.shiftKey) {
      document.execCommand("insertLineBreak")
      e.preventDefault()
    }
  }, [onKeyDown])

  // Initial render
  useEffect(() => {
    if (!editorRef.current) return
    
    if (value && value !== rawTextRef.current) {
      rawTextRef.current = value
      updateFormattedContent(value, false)
    } else if (!value && editorRef.current.innerHTML !== "<br>") {
      editorRef.current.innerHTML = "<br>"
      rawTextRef.current = ""
    }
  }, []) // Only on mount

  const hasContent = value && value.trim().length > 0

  return (
    <div
      ref={editorRef}
      contentEditable={!disabled}
      suppressContentEditableWarning
      onInput={handleInput}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      className={cn(
        "w-full bg-transparent border-0 resize-none",
        "text-white/80 whitespace-pre-wrap break-words",
        "focus:outline-none focus:ring-0",
        sizeClasses[size],
        "leading-relaxed",
        disabled && "cursor-not-allowed opacity-50",
        !disabled && "cursor-text",
        !hasContent && "empty:before:content-[attr(data-placeholder)] empty:before:text-white/40 empty:before:italic",
        className
      )}
      data-placeholder={placeholder}
      style={{
        minHeight: `${minHeight}px`,
        maxHeight: maxHeight ? `${maxHeight}px` : undefined,
        overflowY: maxHeight ? "auto" : "hidden",
      }}
      role="textbox"
      aria-multiline="true"
      aria-disabled={disabled}
      aria-placeholder={placeholder}
    />
  )
}
