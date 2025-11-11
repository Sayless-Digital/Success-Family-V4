"use client"

import Link from "next/link"
import { useState } from "react"
import { 
  Building2,
  Users,
  Sparkles,
  ArrowRight,
  Plus
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/components/auth-provider"
import { CreateCommunityDialog } from "@/components/create-community-dialog"
import { AuthDialog } from "@/components/auth-dialog"

export default function LearnMoreView() {
  const { user } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 max-w-4xl mx-auto space-y-12 py-8">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
            Build & Join Communities
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
            Connect with like-minded individuals, share your journey, and grow together.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-2">
            <Button 
              size="lg" 
              onClick={() => user ? setCreateOpen(true) : setAuthOpen(true)}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              Create Community
              <Plus className="ml-2 h-4 w-4" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              asChild
            >
              <Link href="/communities">
                Explore Communities
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Key Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-white/10 backdrop-blur-md border-0">
            <CardContent className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center mx-auto">
                <Building2 className="h-6 w-6 text-white/80" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                Create Communities
              </h3>
              <p className="text-white/70 text-sm leading-relaxed">
                Start your own community and build a space for like-minded individuals to connect and grow.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-0">
            <CardContent className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center mx-auto">
                <Users className="h-6 w-6 text-white/80" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                Join Communities
              </h3>
              <p className="text-white/70 text-sm leading-relaxed">
                Discover and join communities that match your interests and connect with creators.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-0">
            <CardContent className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center mx-auto">
                <Sparkles className="h-6 w-6 text-white/80" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                Grow & Earn
              </h3>
              <p className="text-white/70 text-sm leading-relaxed">
                Monetize your content, boost posts you love, and build your influence in the community.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <Card className="bg-white/10 backdrop-blur-md border-0">
          <CardContent className="p-8 text-center space-y-4">
            <h2 className="text-2xl font-bold text-white">
              Ready to Get Started?
            </h2>
            <p className="text-white/80 text-base max-w-xl mx-auto">
              Join thousands of creators who are already building their success on the platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-2">
              <Button 
                size="lg" 
                onClick={() => user ? setCreateOpen(true) : setAuthOpen(true)}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                Create Your Community
                <Plus className="ml-2 h-4 w-4" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                asChild
              >
                <Link href="/communities">
                  Browse Communities
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <CreateCommunityDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultTab="signin" />
    </div>
  )
}
