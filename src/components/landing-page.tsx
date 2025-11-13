"use client"

import React, { useState } from "react"
import Link from "next/link"
import { ArrowRight, Users, TrendingUp, Sparkles, Shield, Zap, Target, CheckCircle2, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { AuthDialog } from "@/components/auth-dialog"

interface LandingPageProps {
  currentUserCount: number
  userGoal: number
}

export function LandingPage({ currentUserCount, userGoal }: LandingPageProps) {
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authDialogTab, setAuthDialogTab] = useState<"signin" | "signup">("signup")

  const handleSignUp = () => {
    setAuthDialogTab("signup")
    setAuthDialogOpen(true)
  }

  const handleSignIn = () => {
    setAuthDialogTab("signin")
    setAuthDialogOpen(true)
  }

  const progressPercentage = userGoal > 0 ? Math.min((currentUserCount / userGoal) * 100, 100) : 0

  const features = [
    {
      icon: Sparkles,
      title: "Earn from Content",
      description: "Get rewarded for creating valuable content and engaging with your community"
    },
    {
      icon: Users,
      title: "Join Communities",
      description: "Connect with like-minded individuals in focused communities"
    },
    {
      icon: TrendingUp,
      title: "Boost & Discover",
      description: "Help creators reach their goals while discovering amazing content"
    },
    {
      icon: Shield,
      title: "Secure Platform",
      description: "Your data and earnings are protected with enterprise-grade security"
    },
    {
      icon: Zap,
      title: "Real-time Updates",
      description: "Stay connected with live events, streams, and instant notifications"
    },
    {
      icon: Target,
      title: "Achieve Goals",
      description: "Set milestones and track your progress toward success"
    }
  ]

  return (
    <>
      <div className="relative w-full min-h-screen flex flex-col">
        {/* Hero Section */}
        <section className="relative flex flex-col items-center justify-center min-h-[85vh] px-4 sm:px-6 lg:px-8 py-20 sm:py-24 lg:py-32">
          <div className="max-w-5xl mx-auto text-center space-y-8 sm:space-y-10">
            {/* Main Heading */}
            <div className="space-y-4 sm:space-y-6">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight">
                Build Your
                <span className="block bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
                  Success Family
                </span>
              </h1>
              <p className="text-lg sm:text-xl md:text-2xl text-white/80 max-w-3xl mx-auto leading-relaxed">
                Join a thriving community where creators earn, connect, and grow together. 
                Start your journey today.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-4">
              <Button
                onClick={handleSignUp}
                size="lg"
                className="bg-white/10 text-white hover:bg-white/20 border border-white/20 text-base sm:text-lg px-8 py-6 h-auto font-semibold shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
              >
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                onClick={handleSignIn}
                variant="outline"
                size="lg"
                className="bg-white/5 text-white hover:bg-white/10 border-white/20 text-base sm:text-lg px-8 py-6 h-auto font-semibold"
              >
                Sign In
              </Button>
            </div>

            {/* Stats */}
            <div className="pt-8 sm:pt-12">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2">
                    {currentUserCount.toLocaleString()}
                  </div>
                  <div className="text-sm sm:text-base text-white/70">Active Members</div>
                </div>
                {userGoal > 0 && (
                  <>
                    <div className="hidden sm:block w-px h-12 bg-white/20" />
                    <div className="text-center">
                      <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2">
                        {userGoal.toLocaleString()}
                      </div>
                      <div className="text-sm sm:text-base text-white/70">Goal</div>
                      <div className="mt-2 w-32 sm:w-40 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-white via-white/90 to-white/70 transition-all duration-1000 ease-out"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="relative px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
                Why Join Success Family?
              </h2>
              <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto">
                Everything you need to grow, earn, and connect with your community
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {features.map((feature, index) => {
                const Icon = feature.icon
                return (
                  <Card
                    key={index}
                    className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border-0 hover:from-white/15 hover:to-white/10 transition-all duration-300 group"
                  >
                    <CardContent className="p-6 sm:p-8">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                          <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-white/90" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl sm:text-2xl font-semibold text-white mb-2">
                            {feature.title}
                          </h3>
                          <p className="text-sm sm:text-base text-white/70 leading-relaxed">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border-0 overflow-hidden">
              <CardContent className="p-8 sm:p-12 lg:p-16 text-center">
                <div className="space-y-6 sm:space-y-8">
                  <div className="space-y-4">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">
                      Ready to Get Started?
                    </h2>
                    <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto">
                      Join thousands of creators building their success story. Start earning, connecting, and growing today.
                    </p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-4">
                    <Button
                      onClick={handleSignUp}
                      size="lg"
                      className="bg-white/10 text-white hover:bg-white/20 border border-white/20 text-base sm:text-lg px-8 py-6 h-auto font-semibold shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                    >
                      Create Account
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                    <Button
                      onClick={handleSignIn}
                      variant="outline"
                      size="lg"
                      className="bg-white/5 text-white hover:bg-white/10 border-white/20 text-base sm:text-lg px-8 py-6 h-auto font-semibold"
                    >
                      Sign In
                    </Button>
                  </div>

                  <div className="pt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm sm:text-base text-white/60">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-white/70" />
                      <span>Free to join</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-white/70" />
                      <span>No credit card required</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-white/70" />
                      <span>Start earning immediately</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      <AuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        defaultTab={authDialogTab}
      />
    </>
  )
}


