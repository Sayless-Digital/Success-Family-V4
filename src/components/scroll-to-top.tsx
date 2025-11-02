"use client"

import React, { useState, useEffect } from "react"
import { ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)

    return () => {
      window.removeEventListener("resize", checkMobile)
    }
  }, [])

  useEffect(() => {
    // Find the scrollable main element
    const scrollableElement = document.querySelector('main[class*="overflow-y-auto"]') as HTMLElement

    if (!scrollableElement) {
      return
    }

    const toggleVisibility = () => {
      // Show button when page is scrolled down more than 50px
      const scrollTop = scrollableElement.scrollTop
      if (scrollTop > 50) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    scrollableElement.addEventListener("scroll", toggleVisibility)
    
    // Check initial state
    toggleVisibility()

    return () => {
      scrollableElement.removeEventListener("scroll", toggleVisibility)
    }
  }, [])

  const scrollToTop = () => {
    const scrollableElement = document.querySelector('main[class*="overflow-y-auto"]') as HTMLElement
    if (scrollableElement) {
      scrollableElement.scrollTo({
        top: 0,
        behavior: "smooth"
      })
    }
  }

  if (!isVisible) {
    return null
  }

  return (
    <Button
      onClick={scrollToTop}
      size="icon"
      className={cn(
        "fixed right-4 z-50 h-12 w-12 rounded-full",
        // Account for mobile bottom nav (48px + 16px spacing = 64px)
        isMobile ? "bottom-16" : "bottom-4",
        "bg-white/10 backdrop-blur-md border border-white/20",
        "hover:bg-white/20 hover:border-white/30",
        "transition-all duration-300",
        "shadow-lg"
      )}
      aria-label="Scroll to top"
    >
      <ArrowUp className="h-5 w-5 text-white/80" />
    </Button>
  )
}

