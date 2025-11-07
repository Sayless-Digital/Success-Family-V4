"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import * as React from "react"
import { useAuth } from "@/components/auth-provider"
import { CreateCommunityDialog } from "@/components/create-community-dialog"
import { AuthDialog } from "@/components/auth-dialog"

export default function Home() {
  const { user } = useAuth()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [authOpen, setAuthOpen] = React.useState(false)
  
  return (
    <div className="relative flex flex-col items-center justify-center flex-1 w-full overflow-x-hidden -my-4">
      {/* Content */}
      <div className="relative z-10 w-full">
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
            <Button 
              size="default" 
              className="group gap-2 touch-feedback shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-shadow duration-300" 
              onClick={() => (user ? setCreateOpen(true) : setAuthOpen(true))}
            >
              Create Community
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button 
              size="default" 
              variant="outline" 
              asChild 
              className="touch-feedback bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20 hover:border-white/30"
            >
              <Link href="/communities">
                Explore Communities
              </Link>
            </Button>
          </div>
        </div>
    </div>
    <CreateCommunityDialog open={createOpen} onOpenChange={setCreateOpen} />
    <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultTab="signin" />
    </div>
  )
}