"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, CheckCircle2, ArrowRight, MessageCircle, Calendar, Users, Sparkles, Video } from "lucide-react"
import { toast } from "sonner"
import Plyr from "plyr-react"
import "plyr/dist/plyr.css"
import { cn } from "@/lib/utils"
import type { CSSProperties } from "react"

interface LearnPageSettings {
  videoId: string | null
  videoUrl: string | null
  videoTitle: string | null
  redirectLink: string | null
}

interface LearnMoreViewProps {
  settings: LearnPageSettings
}

export default function LearnMoreView({ settings }: LearnMoreViewProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    whatsappNumber: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [countdown, setCountdown] = useState(5)

  // Auto-redirect countdown
  useEffect(() => {
    if (showSuccess && settings.redirectLink) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            window.location.href = settings.redirectLink!
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [showSuccess, settings.redirectLink])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/webinar/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          countryCode: "+1", // Default country code
          whatsappNumber: formData.whatsappNumber.replace(/\D/g, ""), // Remove formatting, keep only digits
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to sign up")
      }

      setShowSuccess(true)
      toast.success("Successfully signed up for the webinar!")
    } catch (error) {
      console.error("Signup error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to sign up. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (showSuccess) {
    return (
      <div className="relative w-full overflow-x-hidden">
        <div className="relative z-10 flex items-center justify-center min-h-[60vh] py-12">
          <Card className="bg-white/10 backdrop-blur-md border-0 max-w-2xl w-full shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <CardContent className="p-8 sm:p-12">
              <div className="flex flex-col items-center justify-center text-center space-y-8">
                {/* Success Icon */}
                <div className="relative">
                  <div className="absolute inset-0 bg-white/20 rounded-full blur-xl animate-pulse" />
                  <div className="relative h-28 w-28 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center border-4 border-white/30 shadow-lg">
                    <CheckCircle2 className="h-14 w-14 text-white" />
                  </div>
                </div>

                {/* Success Message */}
                <div className="space-y-4">
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight">
                    You're All Set!
                  </h2>
                  <p className="text-lg sm:text-xl text-white/80 max-w-md mx-auto leading-relaxed">
                    Welcome to your journey of getting paid for your passion! We'll send you everything you need to get started.
                  </p>
                </div>

                {/* Redirect Section */}
                {settings.redirectLink && (
                  <div className="space-y-6 w-full max-w-md pt-4">
                    {countdown > 0 && (
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20">
                        <Calendar className="h-4 w-4 text-white/70" />
                        <p className="text-sm font-medium text-white/80">
                          Redirecting in {countdown} second{countdown !== 1 ? "s" : ""}...
                        </p>
                      </div>
                    )}
                    <Button
                      onClick={() => {
                        window.location.href = settings.redirectLink!
                      }}
                      size="lg"
                      className="w-full bg-white/10 text-white hover:bg-white/20 border border-white/20 text-base sm:text-lg px-8 py-6 h-auto font-semibold shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all hover:scale-[1.02]"
                    >
                      <MessageCircle className="h-5 w-5 mr-2 text-white/80" />
                      Join WhatsApp Community
                      <ArrowRight className="h-5 w-5 ml-2 text-white/80" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10">
        {/* Hero Section with Video First */}
        <section className="relative flex flex-col items-center justify-center py-8 sm:py-12 lg:py-16">
          <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8">
            {/* Compact Hero Heading */}
            <div className="text-center space-y-4 sm:space-y-6 mb-8 sm:mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white/80">
                <Sparkles className="h-4 w-4 text-white/70" />
                Revolutionary Training
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                Get Paid for Your
                <span className="block bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
                  Passion on Social Media
                </span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
                Learn how to turn what you love into income. Follow your passion, create content, and get paid for it.
              </p>
            </div>

            {/* Video Section - Prominently Placed */}
            {settings.videoUrl && (
              <div className="mb-8 sm:mb-10">
                <Card className="bg-white/10 backdrop-blur-md border-0 shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden">
                  <CardContent className="p-0">
                    <LearnPageVideoPlayer videoUrl={settings.videoUrl} />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Features */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-8 sm:mb-10">
              <div className="flex items-center gap-2 text-white/80">
                <Calendar className="h-5 w-5 text-white/70" />
                <span className="text-sm sm:text-base">Weekly Live Sessions</span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <Video className="h-5 w-5 text-white/70" />
                <span className="text-sm sm:text-base">Pre-Recorded Videos</span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <Users className="h-5 w-5 text-white/70" />
                <span className="text-sm sm:text-base">Resources & Tools</span>
              </div>
            </div>

            {/* Signup Form */}
            <Card className="bg-white/10 backdrop-blur-md border-0 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3">
                  Start Your Journey
                </CardTitle>
                <CardDescription className="text-white/80 text-base sm:text-lg max-w-2xl mx-auto">
                  Join our comprehensive training program and learn how to monetize your passion. 
                  Get access to weekly live sessions, pre-recorded videos, and valuable resources.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 sm:px-8 pb-8 sm:pb-10">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-white/90 font-medium text-sm sm:text-base">
                        First Name
                      </Label>
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="John"
                        value={formData.firstName}
                        onChange={(e) =>
                          setFormData({ ...formData, firstName: e.target.value })
                        }
                        required
                        disabled={isSubmitting}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12 text-base focus:border-white/40 focus:ring-2 focus:ring-white/20 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-white/90 font-medium text-sm sm:text-base">
                        Last Name
                      </Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="Doe"
                        value={formData.lastName}
                        onChange={(e) =>
                          setFormData({ ...formData, lastName: e.target.value })
                        }
                        required
                        disabled={isSubmitting}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12 text-base focus:border-white/40 focus:ring-2 focus:ring-white/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whatsapp" className="text-white/90 font-medium text-sm sm:text-base">
                      WhatsApp Contact Number
                    </Label>
                    <div className="relative">
                      <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 pointer-events-none" />
                      <Input
                        id="whatsapp"
                        type="tel"
                        placeholder="(123) 456-7890"
                        value={formData.whatsappNumber}
                        onChange={(e) => {
                          // Remove all non-digits
                          const digits = e.target.value.replace(/\D/g, "")
                          // Format as (XXX) XXX-XXXX
                          let formatted = ""
                          if (digits.length > 0) {
                            if (digits.length <= 3) {
                              formatted = `(${digits}`
                            } else if (digits.length <= 6) {
                              formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`
                            } else {
                              formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
                            }
                          }
                          setFormData({
                            ...formData,
                            whatsappNumber: formatted,
                          })
                        }}
                        required
                        disabled={isSubmitting}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12 text-base pl-12 focus:border-white/40 focus:ring-2 focus:ring-white/20 transition-all"
                      />
                    </div>
                    <p className="text-xs sm:text-sm text-white/60 mt-1">
                      We'll send you the training link and community access
                    </p>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    className="w-full h-12 sm:h-14 text-base sm:text-lg font-bold relative overflow-hidden group text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    style={!isSubmitting ? {
                      background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #9333EA 100%)',
                      boxShadow: '0 0 15px rgba(255, 215, 0, 0.5), 0 0 30px rgba(147, 51, 234, 0.3)',
                    } : undefined}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin text-white" />
                        Signing Up...
                      </>
                    ) : (
                      <>
                        <span className="relative z-10 drop-shadow-lg">Reserve My Spot</span>
                        <ArrowRight className="h-5 w-5 ml-2 text-white drop-shadow-lg relative z-10" />
                        {/* Shimmer effect on button */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  )
}

function LearnPageVideoPlayer({ videoUrl }: { videoUrl: string }) {
  const plyrSource = useMemo(() => {
    if (!videoUrl) {
      return { type: "video" as const, sources: [] }
    }
    return {
      type: "video" as const,
      sources: [
        {
          src: videoUrl,
          type: detectMime(videoUrl) ?? "video/mp4",
        },
      ],
    }
  }, [videoUrl])

  const plyrOptions = useMemo(
    () => ({
      controls: ["play", "progress", "current-time", "mute", "volume", "fullscreen"],
      clickToPlay: true,
      tooltips: { controls: true, seek: true },
      keyboard: { focused: true, global: false },
    }),
    [],
  )

  const playerStyles = useMemo(
    () =>
      ({
        "--plyr-color-main": "hsl(var(--primary))",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "100%",
      }) as CSSProperties,
    [],
  )

  return (
    <div
      className={cn("secure-video-card relative aspect-video w-full overflow-hidden rounded-lg bg-black")}
      onContextMenu={(evt) => evt.preventDefault()}
      style={playerStyles}
    >
      <Plyr source={plyrSource} options={plyrOptions} />
    </div>
  )
}

function detectMime(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const lower = url.toLowerCase()
  if (lower.includes(".mp4") || lower.includes("video/mp4")) return "video/mp4"
  if (lower.includes(".webm") || lower.includes("video/webm")) return "video/webm"
  if (lower.includes(".mov") || lower.includes("video/quicktime")) return "video/quicktime"
  if (lower.includes(".m4v") || lower.includes("video/x-m4v")) return "video/x-m4v"
  return undefined
}
