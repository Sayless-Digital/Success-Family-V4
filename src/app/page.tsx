"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Aurora from "@/components/Aurora"
import { useAuroraColors } from "@/lib/use-aurora-colors"

export default function Home() {
  // Get colors from global CSS custom properties
  const colorStops = useAuroraColors()
  
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] w-full overflow-x-hidden">
      {/* Aurora Background */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.8} />
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        <div className="text-center space-y-6 max-w-2xl mx-auto">
          {/* Hero Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
            Welcome to
            <span className="block mt-2">
              Success Family
            </span>
          </h1>
          
          {/* Hero Description */}
          <p className="text-base md:text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            A thriving community platform where success-driven individuals connect,
            collaborate, and grow together.
          </p>

          {/* Call to Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-2">
            <Button size="default" className="group gap-2" asChild>
              <a href="/create-community">
                Create Community
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
            <Button size="default" variant="outline" asChild>
              <a href="/communities">
                Explore Communities
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}