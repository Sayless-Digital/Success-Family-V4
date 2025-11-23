"use client"

import React from "react"
import Link from "next/link"
import { parseMarkdown } from "@/lib/markdown-parser"
import { linkifyText } from "@/lib/utils"
import { LinkPreviewCard } from "@/components/link-preview-card"
import { useLinkPreview } from "@/hooks/use-link-preview"
import { extractFirstUrl, extractUrls } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface FormattedContentProps {
  text: string
  className?: string
  showLinkPreviews?: boolean
  previewCompact?: boolean
  size?: "sm" | "base" | "lg"
}

/**
 * Unified content renderer that handles:
 * - Markdown formatting (**bold**, *italic*, ~strike~)
 * - Link detection and rendering
 * - Link preview cards (optional)
 * - Emoji rendering (native)
 */
export function FormattedContent({
  text,
  className,
  showLinkPreviews = false,
  previewCompact = false,
  size = "base",
}: FormattedContentProps) {
  if (!text) return null

  // Extract URLs for preview
  const urls = extractUrls(text)
  const firstUrl = urls.length > 0 ? urls[0] : null

  // Fetch preview for first URL (if enabled)
  const { preview, loading } = useLinkPreview(firstUrl, {
    enabled: showLinkPreviews && !!firstUrl,
    debounceMs: 300, // Faster debounce for display (already rendered)
  })

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
    <div className={cn("space-y-2", className)}>
      <div className={cn(
        "text-white/80 whitespace-pre-wrap break-words leading-relaxed",
        sizeClasses[size]
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

      {/* Link preview card */}
      {showLinkPreviews && (preview || loading) && (
        <LinkPreviewCard
          preview={preview}
          loading={loading}
          compact={previewCompact}
        />
      )}
    </div>
  )
}

