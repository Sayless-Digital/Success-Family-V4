"use client"

import Link from "next/link"
import { Home, Search, Compass } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated background gradient overlay for extra depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent animate-pulse" />
      
      <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
        {/* Animated Icon */}
        <div className="mb-8 flex justify-center animate-bounce-gentle">
          <div className="relative">
            <Compass className="h-20 w-20 sm:h-24 sm:w-24 text-white/80" />
            <div className="absolute inset-0 rounded-full bg-white/20 blur-xl animate-pulse" />
          </div>
        </div>

        {/* Playful Error Message */}
        <div className="mb-8 space-y-4">
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white/90 animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            Oops! You're a bit lost
          </h2>
          <p 
            className="text-lg sm:text-xl text-white/70 max-w-lg mx-auto animate-fade-in-up"
            style={{ animationDelay: "0.4s" }}
          >
            Looks like this page went on a little adventure and didn't leave a map. 
            No worries though—let's get you back to familiar territory!
          </p>
        </div>

        {/* Action Buttons */}
        <div 
          className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up"
          style={{ animationDelay: "0.6s" }}
        >
          <Button
            asChild
            variant="outline"
            size="lg"
            className="group bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30 backdrop-blur-sm"
          >
            <Link href="/" className="flex items-center gap-2">
              <Home className="h-4 w-4 text-white/80 group-hover:text-white transition-colors" />
              Take Me Home
            </Link>
          </Button>
          
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="group text-white/80 hover:text-white hover:bg-white/10"
          >
            <Link href="/communities" className="flex items-center gap-2">
              <Search className="h-4 w-4 text-white/80 group-hover:text-white transition-colors" />
              Explore Communities
            </Link>
          </Button>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-white/5 rounded-full blur-3xl animate-pulse" />
        <div 
          className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-white/5 rounded-full blur-3xl animate-pulse" 
          style={{ animationDelay: "1s" }} 
        />
      </div>
    </div>
  )
}

