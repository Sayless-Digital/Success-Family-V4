"use client"

import * as React from "react"

interface TwemojiTextProps {
  text: string
  className?: string
  size?: number
}

export function TwemojiText({ text, className = "", size = 20 }: TwemojiTextProps) {
  return (
    <span className={className} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {text}
    </span>
  )
}
