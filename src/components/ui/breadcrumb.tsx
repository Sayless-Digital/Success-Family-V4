"use client"

import * as React from "react"
import { ChevronRight, Home } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface BreadcrumbItem {
  label: string
  href?: string
  icon?: React.ComponentType<{ className?: string }>
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={cn("flex items-center space-x-1 text-sm", className)}>
      {/* Home - always text with optional icon */}
      <Link 
        href="/admin" 
        className="flex items-center gap-1 text-white/60 hover:text-white transition-colors"
      >
        <Home className="h-4 w-4" />
        <span>Dashboard</span>
      </Link>
      
      {/* Breadcrumb items */}
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="h-4 w-4 text-white/40" />
          {item.href ? (
            <Link 
              href={item.href}
              className="flex items-center gap-1 text-white/60 hover:text-white transition-colors"
            >
              {item.icon && <item.icon className="h-4 w-4" />}
              <span>{item.label}</span>
            </Link>
          ) : (
            <span className="flex items-center gap-1 text-white font-medium">
              {item.icon && <item.icon className="h-4 w-4" />}
              <span>{item.label}</span>
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}
