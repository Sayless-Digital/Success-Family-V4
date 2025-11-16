"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { InfoTooltip } from "./tooltip"

interface FieldLabelProps {
  htmlFor: string
  label: React.ReactNode
  tooltipContent?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

const FieldLabel = React.forwardRef<HTMLDivElement, FieldLabelProps>(
  ({ htmlFor, label, tooltipContent, className, children }, ref) => {
    return (
      <div ref={ref} className={cn("flex items-center gap-2 text-sm font-medium text-white/80", className)}>
        <label htmlFor={htmlFor} className="cursor-default">
          {label}
        </label>
        {tooltipContent ? (
          <InfoTooltip
            content={tooltipContent}
            ariaLabel={typeof label === "string" ? `${label} information` : "Field information"}
            className="text-left"
          />
        ) : null}
        {children}
      </div>
    )
  },
)
FieldLabel.displayName = "FieldLabel"

export { FieldLabel }












