"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { signIn, signUp } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { CheckCircle2, Mail, ArrowRight, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTab?: "signin" | "signup"
}

export function AuthDialog({ open, onOpenChange, defaultTab = "signin" }: AuthDialogProps) {
  const [activeTab, setActiveTab] = React.useState(defaultTab)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [showSignUpSuccess, setShowSignUpSuccess] = React.useState(false)

  // Update active tab when defaultTab changes
  React.useEffect(() => {
    if (open) {
      setActiveTab(defaultTab)
      setError(null)
      setShowSignUpSuccess(false)
    }
  }, [open, defaultTab])

  // Sign In form state
  const [signInData, setSignInData] = React.useState({
    email: "",
    password: "",
  })

  // Sign Up form state
  const [signUpData, setSignUpData] = React.useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  })

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const result = await signIn({
      email: signInData.email,
      password: signInData.password,
    })

    setIsLoading(false)

    if (result.success) {
      // Close dialog immediately without showing success message
      onOpenChange(false)
      // Reset form
      setSignInData({ email: "", password: "" })
      toast.success("Welcome back! Signed in successfully!")
    } else {
      setError(result.error?.message || "Failed to sign in")
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const result = await signUp({
      email: signUpData.email,
      password: signUpData.password,
      firstName: signUpData.firstName,
      lastName: signUpData.lastName,
    })

    setIsLoading(false)

    if (result.success) {
      // Show success screen instead of auto-closing
      setShowSignUpSuccess(true)
      toast.success("Account created! Check your email.")
    } else {
      setError(result.error?.message || "Failed to sign up")
    }
  }

  const handleCloseSuccessScreen = () => {
    setShowSignUpSuccess(false)
    setSignUpData({ firstName: "", lastName: "", email: "", password: "" })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-6">
        {showSignUpSuccess ? (
          // Success Screen
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-6">
            <div className="relative">
              <CheckCircle2 className="h-24 w-24 text-green-600 animate-in zoom-in duration-300" />
              <div className="absolute -bottom-2 -right-2 bg-green-100 rounded-full p-2">
                <Mail className="h-8 w-8 text-green-600" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Account Created!</h2>
              <p className="text-base text-muted-foreground max-w-sm">
                We've sent a confirmation email to <strong className="text-foreground">{signUpData.email || "your email"}</strong>
              </p>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  Next Steps:
                </p>
              </div>
              <ol className="text-sm text-muted-foreground space-y-2 text-left">
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Check your email inbox</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Click the confirmation link</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Come back and sign in</span>
                </li>
              </ol>
            </div>

            <Button
              onClick={handleCloseSuccessScreen}
              className="w-full"
              size="lg"
            >
              Got it, close
            </Button>

            <p className="text-xs text-muted-foreground">
              Didn't receive the email? Check your spam folder
            </p>
          </div>
        ) : (
          // Regular Auth Forms
          <>
            <DialogHeader className="text-center space-y-4 px-0">
              {/* Site Logo */}
              <div className="flex justify-center">
                <div className="h-12 w-12 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg border border-white/20 shadow-lg backdrop-blur-md">
                  SF
                </div>
              </div>
              
              <div className="space-y-2 text-center">
                <DialogTitle className="text-2xl font-semibold text-center">Welcome back</DialogTitle>
                <DialogDescription className="text-base text-muted-foreground text-center">
                  Sign in to your account or create a new one
                </DialogDescription>
              </div>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "signin" | "signup")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20 p-1 h-auto">
            <TabsTrigger value="signin" className="data-[state=active]:bg-white/20 data-[state=active]:text-white px-6 py-2">Sign In</TabsTrigger>
            <TabsTrigger value="signup" className="data-[state=active]:bg-white/20 data-[state=active]:text-white px-6 py-2">Sign Up</TabsTrigger>
          </TabsList>

          {/* Sign In Tab */}
          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="you@example.com"
                  value={signInData.email}
                  onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  type="password"
                  placeholder="••••••••"
                  value={signInData.password}
                  onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full relative" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in...</span>
                  </span>
                ) : "Sign In"}
              </Button>
            </form>
          </TabsContent>

          {/* Sign Up Tab */}
          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-firstname">First Name</Label>
                  <Input
                    id="signup-firstname"
                    type="text"
                    placeholder="John"
                    value={signUpData.firstName}
                    onChange={(e) => setSignUpData({ ...signUpData, firstName: e.target.value })}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-lastname">Last Name</Label>
                  <Input
                    id="signup-lastname"
                    type="text"
                    placeholder="Doe"
                    value={signUpData.lastName}
                    onChange={(e) => setSignUpData({ ...signUpData, lastName: e.target.value })}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={signUpData.email}
                  onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={signUpData.password}
                  onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                  required
                  disabled={isLoading}
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Password must be at least 6 characters
                </p>
              </div>

              {error && (
                <div className="text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full relative" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating account...</span>
                  </span>
                ) : "Sign Up"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}