"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { signUp } from "@/lib/auth"
import { Loader2, Eye, EyeOff, Gift, User as UserIcon, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

interface ReferralSignupViewProps {
  referrerUser: {
    id: string
    username: string
    first_name: string
    last_name: string
    profile_picture?: string | null
  }
  referralBonusPoints: number
  referralMaxTopups: number
}

export function ReferralSignupView({
  referrerUser,
  referralBonusPoints,
  referralMaxTopups,
}: ReferralSignupViewProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)
  const passwordCursorRef = useRef<number | null>(null)

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  })

  // Restore cursor position after password visibility toggle
  useEffect(() => {
    if (passwordCursorRef.current !== null) {
      const position = passwordCursorRef.current
      const timer = setTimeout(() => {
        const input = passwordRef.current
        if (input) {
          input.focus()
          input.setSelectionRange(position, position)
          setTimeout(() => {
            if (input && document.activeElement === input) {
              input.setSelectionRange(position, position)
            }
          }, 10)
        }
        passwordCursorRef.current = null
      }, 10)
      return () => clearTimeout(timer)
    }
  }, [showPassword])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const result = await signUp({
      email: formData.email,
      password: formData.password,
      firstName: formData.firstName,
      lastName: formData.lastName,
      referredByUserId: referrerUser.id,
    })

    setIsLoading(false)

    if (result.success) {
      setShowSuccess(true)
      toast.success("Account created! Check your email.")
    } else {
      setError(result.error?.message || "Failed to sign up")
    }
  }

  if (showSuccess) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Account Created!"
          subtitle="We've sent a confirmation email to your inbox"
          className="text-center"
        />
        <Card className="bg-white/5 border-white/20 border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-6">
              <div className="relative">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-4xl font-bold border-4 border-white/20">
                  ✓
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">Welcome to Success Family!</h2>
                <p className="text-base text-white/60 max-w-sm">
                  We've sent a confirmation email to <strong className="text-white">{formData.email || "your email"}</strong>
                </p>
              </div>

              <div className="bg-white/10 border border-white/20 rounded-lg p-4 space-y-3 w-full max-w-md">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-5 w-5 text-white/70" />
                  <p className="text-sm font-semibold text-white">Referred By</p>
                </div>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-white/20">
                    <AvatarImage src={referrerUser.profile_picture || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white text-sm">
                      {referrerUser.first_name[0]}{referrerUser.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {referrerUser.first_name} {referrerUser.last_name}
                    </p>
                    <p className="text-xs text-white/60">@{referrerUser.username}</p>
                  </div>
                </div>
                <p className="text-xs text-white/60">
                  {referrerUser.first_name} will earn {referralBonusPoints} points when you top up (for your first {referralMaxTopups} top-ups)!
                </p>
              </div>

              <div className="bg-white/10 border border-white/20 rounded-lg p-4 space-y-3 w-full max-w-md">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-5 w-5 text-white/70" />
                  <p className="text-sm font-semibold text-white">Next Steps:</p>
                </div>
                <ol className="text-sm text-white/60 space-y-2 text-left">
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-white/70 mt-0.5 flex-shrink-0" />
                    <span>Check your email inbox</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-white/70 mt-0.5 flex-shrink-0" />
                    <span>Click the confirmation link</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-white/70 mt-0.5 flex-shrink-0" />
                    <span>Come back and sign in</span>
                  </li>
                </ol>
              </div>

              <div className="flex gap-4 w-full max-w-md">
                <Button
                  onClick={() => router.push("/")}
                  variant="outline"
                  className="flex-1 border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  Go Home
                </Button>
                <Button
                  onClick={() => router.push("/?signin=true")}
                  className="flex-1 bg-white/10 text-white hover:bg-white/20"
                >
                  Sign In
                </Button>
              </div>

              <p className="text-xs text-white/40">
                Didn't receive the email? Check your spam folder
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Compact Header with Referrer Info */}
      <div className="space-y-4">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
            Join Success Family
          </h1>
          <p className="text-sm sm:text-base text-white/70">
            Create your account and start your journey
          </p>
        </div>

        {/* Neat Referrer Badge */}
        <div className="px-4 py-4 sm:py-3 rounded-lg bg-white/10 border border-white/20 backdrop-blur-sm max-w-2xl mx-auto">
          {/* Mobile: Stacked Layout */}
          <div className="flex flex-col sm:hidden items-center gap-3.5">
            <div className="flex items-center justify-center gap-2">
              <Gift className="h-4 w-4 text-white/70" />
              <span className="text-xs font-medium text-white/70 uppercase tracking-wide">Invited by</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-2.5 w-full">
              <div className="flex justify-center">
                <Avatar className="h-12 w-12 border-2 border-white/20">
                  <AvatarImage src={referrerUser.profile_picture || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white text-base font-semibold">
                    {referrerUser.first_name[0]}{referrerUser.last_name[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="text-center w-full">
                <p className="text-base font-semibold text-white leading-tight">
                  {referrerUser.first_name} {referrerUser.last_name}
                </p>
                <p className="text-xs text-white/60 leading-tight mt-0.5">@{referrerUser.username}</p>
              </div>
            </div>
            <div className="w-full pt-3 border-t border-white/20">
              <p className="text-xs text-white/70 text-center leading-relaxed">
                They'll earn <span className="text-white font-semibold">{referralBonusPoints} points</span> when you top up
              </p>
            </div>
          </div>
          
          {/* Desktop: Horizontal Layout */}
          <div className="hidden sm:flex items-center justify-center gap-x-4">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-white/70 flex-shrink-0" />
              <span className="text-xs font-medium text-white/70 whitespace-nowrap">Invited by</span>
            </div>
            <div className="flex items-center gap-2">
              <Avatar className="h-9 w-9 border-2 border-white/20 flex-shrink-0">
                <AvatarImage src={referrerUser.profile_picture || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white text-xs font-semibold">
                  {referrerUser.first_name[0]}{referrerUser.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold text-white leading-tight">
                  {referrerUser.first_name} {referrerUser.last_name}
                </p>
                <p className="text-xs text-white/60 leading-tight">@{referrerUser.username}</p>
              </div>
            </div>
            <div className="h-6 w-px bg-white/20 flex-shrink-0" />
            <div className="text-left flex-shrink-0">
              <p className="text-xs text-white/70 leading-tight">
                Earns <span className="text-white font-semibold">{referralBonusPoints} points</span>
              </p>
              <p className="text-xs text-white/60 leading-tight">when you top up</p>
            </div>
          </div>
        </div>
      </div>

      {/* Signup Form */}
      <Card className="bg-white/5 border-white/20 border-0">
        <CardHeader className="text-center">
          <CardTitle className="text-white">Create Your Account</CardTitle>
          <CardDescription className="text-white/60">
            Fill in your details to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-white/80">
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
                  disabled={isLoading}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-white/80">
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
                  disabled={isLoading}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isLoading}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80">
                Password
              </Label>
              <div className="relative">
                <Input
                  ref={passwordRef}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  disabled={isLoading}
                  minLength={6}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 pr-10"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const input = passwordRef.current
                    if (input) {
                      passwordCursorRef.current = input.selectionStart || 0
                      setShowPassword(!showPassword)
                    } else {
                      setShowPassword(!showPassword)
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white/90 transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-white/60">
                Password must be at least 6 characters
              </p>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-white/10 text-white hover:bg-white/20"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating account...</span>
                </span>
              ) : (
                "Create Account"
              )}
            </Button>

            <p className="text-xs text-center text-white/60">
              Already have an account?{" "}
              <Link
                href="/?signin=true"
                className="text-white/80 hover:text-white underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

