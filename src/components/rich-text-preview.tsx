"use client"

import React from "react"
import { parseMarkdown } from "@/lib/markdown-parser"
import { linkifyText } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface RichTextPreviewProps {
  text: string
  className?: string
  size?: "sm" | "base" | "lg"
  placeholder?: string
}

/**
 * Live preview of formatted content while typing
 * Shows markdown formatting and links rendered in real-time
 * Similar to WhatsApp's rich text preview
 */
export function RichTextPreview({
  text,
  className,
  size = "base",
  placeholder,
}: RichTextPreviewProps) {
  if (!text || text.trim().length === 0) {
    if (placeholder) {
      return (
        <div className={cn(
          "text-white/40 text-sm italic",
          className
        )}>
          {placeholder}
        </div>
      )
    }
    return null
  }

  // First linkify the text to get links as React elements
  const linkedNodes = linkifyText(text)

  // Then parse markdown on each node
  const processNode = (node: React.ReactNode, index: number): React.ReactNode => {
    if (typeof node === "string") {
      // Parse markdown in string nodes
      const markdownNodes = parseMarkdown(node)
      return (
        <React.Fragment key={`content-${index}`}>
          {markdownNodes.map((mdNode, mdIndex) => (
            <React.Fragment key={`md-${index}-${mdIndex}`}>
              {mdNode}
            </React.Fragment>
          ))}
        </React.Fragment>
      )
    }

    // If it's already a React element (like a link), preserve it but parse markdown in children
    if (React.isValidElement(node)) {
      const props = node.props as { children?: React.ReactNode }
      if (props.children && typeof props.children === "string") {
        const markdownChildren = parseMarkdown(props.children)
        return React.cloneElement(node, { key: `node-${index}` }, markdownChildren)
      }
    }

    return node
  }

  // Process all nodes
  const processedNodes = linkedNodes.map((node, index) => processNode(node, index))

  // Size classes
  const sizeClasses = {
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg",
  }

  return (
    <div className={cn(
      "text-white/80 whitespace-pre-wrap break-words leading-relaxed min-h-[1.5em]",
      sizeClasses[size],
      className
    )}>
      {processedNodes.length > 0 ? (
        <>
          {processedNodes.map((node, index) => (
            <React.Fragment key={`content-wrapper-${index}`}>
              {node}
            </React.Fragment>
          ))}
        </>
      ) : (
        text
      )}
    </div>
  )
}




