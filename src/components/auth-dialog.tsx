"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  BaseDialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/base-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { CheckedState } from "@radix-ui/react-checkbox"
import { Checkbox } from "@/components/ui/checkbox"
import { signIn, signUp } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { CheckCircle2, Mail, ArrowRight, Loader2, Eye, EyeOff, Search, User as UserIcon, X } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTab?: "signin" | "signup"
}

const REMEMBER_ME_STORAGE_KEY = "sf-auth-remember-v1"

export function AuthDialog({ open, onOpenChange, defaultTab = "signin" }: AuthDialogProps) {
  const [activeTab, setActiveTab] = React.useState(defaultTab)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [showSignUpSuccess, setShowSignUpSuccess] = React.useState(false)
  const [showSignInPassword, setShowSignInPassword] = React.useState(false)
  const [showSignUpPassword, setShowSignUpPassword] = React.useState(false)
  const signInPasswordRef = React.useRef<HTMLInputElement>(null)
  const signUpPasswordRef = React.useRef<HTMLInputElement>(null)
  const signInPasswordCursorRef = React.useRef<number | null>(null)
  const signUpPasswordCursorRef = React.useRef<number | null>(null)
  const [signInData, setSignInData] = React.useState({
    email: "",
    password: "",
  })
  const [rememberMe, setRememberMe] = React.useState(false)
  const rememberLoadedRef = React.useRef(false)
  const [signUpData, setSignUpData] = React.useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    referredByUserId: "" as string | undefined,
  })
  const [referralSearch, setReferralSearch] = React.useState("")
  const [referralUsers, setReferralUsers] = React.useState<Array<{
    id: string
    username: string
    first_name: string
    last_name: string
    email: string
    profile_picture?: string
  }>>([])
  const [showReferralDropdown, setShowReferralDropdown] = React.useState(false)
  const [selectedReferrer, setSelectedReferrer] = React.useState<{
    id: string
    username: string
    first_name: string
    last_name: string
  } | null>(null)
  const referralSearchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const referralDropdownRef = React.useRef<HTMLDivElement>(null)
  const [topupBonusEnabled, setTopupBonusEnabled] = React.useState(false)

  // Restore cursor position after password visibility toggle
  React.useEffect(() => {
    if (signInPasswordCursorRef.current !== null) {
      const position = signInPasswordCursorRef.current
      // Small delay to ensure input type change has been processed
      const timer = setTimeout(() => {
        const input = signInPasswordRef.current
        if (input) {
          input.focus()
          // Try setting selection multiple times to ensure it sticks
          input.setSelectionRange(position, position)
          setTimeout(() => {
            if (input && document.activeElement === input) {
              input.setSelectionRange(position, position)
            }
          }, 10)
        }
        signInPasswordCursorRef.current = null
      }, 10)
      return () => clearTimeout(timer)
    }
  }, [showSignInPassword])

  React.useEffect(() => {
    if (signUpPasswordCursorRef.current !== null) {
      const position = signUpPasswordCursorRef.current
      // Small delay to ensure input type change has been processed
      const timer = setTimeout(() => {
        const input = signUpPasswordRef.current
        if (input) {
          input.focus()
          // Try setting selection multiple times to ensure it sticks
          input.setSelectionRange(position, position)
          setTimeout(() => {
            if (input && document.activeElement === input) {
              input.setSelectionRange(position, position)
            }
          }, 10)
        }
        signUpPasswordCursorRef.current = null
      }, 10)
      return () => clearTimeout(timer)
    }
  }, [showSignUpPassword])

  // Update active tab when defaultTab changes
  React.useEffect(() => {
    if (open) {
      setActiveTab(defaultTab)
      setError(null)
      setShowSignUpSuccess(false)
      setShowSignInPassword(false)
      setShowSignUpPassword(false)
    }
  }, [open, defaultTab])

  // Search for referral users
  const searchReferralUser = React.useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setReferralUsers([])
      setShowReferralDropdown(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, first_name, last_name, email, profile_picture')
        .or(`username.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10)

      if (error) throw error
      setReferralUsers(data || [])
      setShowReferralDropdown(true)
    } catch (error) {
      console.error('Error searching users:', error)
      setReferralUsers([])
    }
  }, [])

  // Fetch top-up bonus enabled status
  React.useEffect(() => {
    if (!open) return
    
    const fetchBonusStatus = async () => {
      try {
        const { data } = await supabase
          .from('platform_settings')
          .select('topup_bonus_enabled, topup_bonus_end_time')
          .eq('id', 1)
          .maybeSingle()
        
        const isEnabled = data?.topup_bonus_enabled ?? false
        const endTime = data?.topup_bonus_end_time ? new Date(data.topup_bonus_end_time) : null
        const isExpired = endTime ? new Date() >= endTime : false
        
        // Only enable if not expired
        setTopupBonusEnabled(isEnabled && !isExpired)
      } catch (error) {
        console.error('Error fetching bonus status:', error)
        setTopupBonusEnabled(false)
      }
    }
    
    fetchBonusStatus()
  }, [open])

  // Auto-detect referral from URL parameter on mount and when dialog opens
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!open || activeTab !== 'signup') return
    if (topupBonusEnabled) return // Skip referral if bonus is enabled
    
    const urlParams = new URLSearchParams(window.location.search)
    const refCode = urlParams.get('ref')
    
    if (refCode && !selectedReferrer && !hasAutoSelectedRef.current) {
      // Search for user by username
      setReferralSearch(refCode)
      searchReferralUser(refCode)
    }
  }, [open, activeTab, searchReferralUser, selectedReferrer, topupBonusEnabled])

  // Handle referral search with debounce
  React.useEffect(() => {
    if (referralSearchTimeoutRef.current) {
      clearTimeout(referralSearchTimeoutRef.current)
    }

    if (referralSearch.length >= 2 && !selectedReferrer) {
      referralSearchTimeoutRef.current = setTimeout(() => {
        searchReferralUser(referralSearch)
      }, 300)
    } else if (referralSearch.length < 2) {
      setReferralUsers([])
      setShowReferralDropdown(false)
    }

    return () => {
      if (referralSearchTimeoutRef.current) {
        clearTimeout(referralSearchTimeoutRef.current)
      }
    }
  }, [referralSearch, selectedReferrer, searchReferralUser])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (referralDropdownRef.current && !referralDropdownRef.current.contains(event.target as Node)) {
        setShowReferralDropdown(false)
      }
    }

    if (showReferralDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showReferralDropdown])

  // Auto-select user if URL ref matches exactly (only once when dialog opens)
  const hasAutoSelectedRef = React.useRef(false)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (selectedReferrer || hasAutoSelectedRef.current) return // Don't auto-select if already selected or already tried
    
    const urlParams = new URLSearchParams(window.location.search)
    const refCode = urlParams.get('ref')
    
    if (refCode && referralUsers.length === 1 && referralUsers[0].username.toLowerCase() === refCode.toLowerCase()) {
      handleSelectReferrer(referralUsers[0])
      hasAutoSelectedRef.current = true
    }
  }, [referralUsers, selectedReferrer])

  // Reset auto-select flag when dialog closes
  React.useEffect(() => {
    if (!open) {
      hasAutoSelectedRef.current = false
    }
  }, [open])

  const handleSelectReferrer = (user: {
    id: string
    username: string
    first_name: string
    last_name: string
  }) => {
    setSelectedReferrer(user)
    setSignUpData(prev => ({ ...prev, referredByUserId: user.id }))
    setReferralSearch(`${user.first_name} ${user.last_name} (@${user.username})`)
    setShowReferralDropdown(false)
  }

  const handleClearReferrer = () => {
    setSelectedReferrer(null)
    setSignUpData(prev => ({ ...prev, referredByUserId: undefined }))
    setReferralSearch("")
    setReferralUsers([])
    setShowReferralDropdown(false)
  }

  // Load remembered email on mount (SECURITY: Never store passwords)
  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    try {
      const saved = window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as { email?: string }
        if (parsed.email) {
          setRememberMe(true)
          setSignInData((current) => ({
            ...current,
            email: parsed.email ?? "",
            // Never restore password - security best practice
            password: "",
          }))
        }
      }
    } catch (storageError) {
      console.error("Failed to load remembered email:", storageError)
      // Clear corrupted data
      window.localStorage.removeItem(REMEMBER_ME_STORAGE_KEY)
    } finally {
      rememberLoadedRef.current = true
    }
  }, [])

  // Save email only when remember me is enabled (SECURITY: Never store passwords)
  React.useEffect(() => {
    if (!rememberLoadedRef.current || typeof window === "undefined") {
      return
    }

    if (!rememberMe) {
      window.localStorage.removeItem(REMEMBER_ME_STORAGE_KEY)
      return
    }

    // Only save email if it's not empty
    if (!signInData.email.trim()) {
      return
    }

    try {
      // SECURITY: Only store email, never password
      const payload = JSON.stringify({
        email: signInData.email,
      })
      window.localStorage.setItem(REMEMBER_ME_STORAGE_KEY, payload)
    } catch (storageError) {
      console.error("Failed to persist remembered email:", storageError)
    }
  }, [rememberMe, signInData.email])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn({
        email: signInData.email,
        password: signInData.password,
      })

      if (result.success && result.user) {
        // ✅ TRUST SUPABASE: signInWithPassword returns session immediately on success
        // The session is already valid and persisted in cookies via @supabase/ssr
        // onAuthStateChange will update UI state in the background automatically
        
        // Close dialog immediately - no need to wait for state changes
        onOpenChange(false)
        
        // Reset form - clear password but keep email if remember me is enabled
        if (!rememberMe) {
          setSignInData({ email: "", password: "" })
        } else {
          // Clear password but keep email
          setSignInData((prev) => ({ ...prev, password: "" }))
        }
        
        // Small delay to ensure smooth UI transition
        await new Promise(resolve => setTimeout(resolve, 100))
        
        toast.success("Welcome back! Signed in successfully!")
      } else {
        setError(result.error?.message || "Failed to sign in")
      }
    } catch (error) {
      console.error("Sign in error:", error)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRememberMeChange = (checked: CheckedState) => {
    const isChecked = checked === true
    setRememberMe(isChecked)

    if (!isChecked) {
      setSignInData((current) => ({
        ...current,
        password: "",
      }))
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
      referredByUserId: signUpData.referredByUserId,
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
    setSignUpData({ firstName: "", lastName: "", email: "", password: "", referredByUserId: undefined })
    setSelectedReferrer(null)
    setReferralSearch("")
    setReferralUsers([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <BaseDialogContent className="sm:max-w-[425px]">
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
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
                <div className="relative">
                  <Input
                    ref={signInPasswordRef}
                    id="signin-password"
                    type={showSignInPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={signInData.password}
                    onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                    required
                    disabled={isLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const input = signInPasswordRef.current
                      if (input) {
                        signInPasswordCursorRef.current = input.selectionStart || 0
                        setShowSignInPassword(!showSignInPassword)
                      } else {
                        setShowSignInPassword(!showSignInPassword)
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white/90 transition-colors"
                    disabled={isLoading}
                  >
                    {showSignInPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="signin-remember"
                  checked={rememberMe}
                  onCheckedChange={handleRememberMeChange}
                  disabled={isLoading}
                />
                <Label
                  htmlFor="signin-remember"
                  className="text-sm text-white/80"
                >
                  Remember me on this device
                </Label>
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
                <div className="relative">
                  <Input
                    ref={signUpPasswordRef}
                    id="signup-password"
                    type={showSignUpPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                    required
                    disabled={isLoading}
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const input = signUpPasswordRef.current
                      if (input) {
                        signUpPasswordCursorRef.current = input.selectionStart || 0
                        setShowSignUpPassword(!showSignUpPassword)
                      } else {
                        setShowSignUpPassword(!showSignUpPassword)
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white/90 transition-colors"
                    disabled={isLoading}
                  >
                    {showSignUpPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Password must be at least 6 characters
                </p>
              </div>

              {!topupBonusEnabled && (
              <div className="space-y-2">
                <Label htmlFor="signup-referral">Referred By (Optional)</Label>
                <div className="relative" ref={referralDropdownRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <Input
                      id="signup-referral"
                      type="text"
                      placeholder="Search for user by username, name, or email..."
                      value={referralSearch}
                      onChange={(e) => {
                        setReferralSearch(e.target.value)
                        if (selectedReferrer) {
                          setSelectedReferrer(null)
                          setSignUpData(prev => ({ ...prev, referredByUserId: undefined }))
                        }
                      }}
                      onFocus={() => {
                        if (referralSearch.length >= 2 && referralUsers.length > 0) {
                          setShowReferralDropdown(true)
                        }
                      }}
                      disabled={isLoading}
                      className="pl-10 pr-10"
                    />
                    {selectedReferrer && (
                      <button
                        type="button"
                        onClick={handleClearReferrer}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white/90 transition-colors"
                        disabled={isLoading}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {showReferralDropdown && referralUsers.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-md border border-white/20 bg-white/5 backdrop-blur-md shadow-lg">
                      {referralUsers.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleSelectReferrer(user)}
                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-3"
                        >
                          {user.profile_picture ? (
                            <img
                              src={user.profile_picture}
                              alt={user.username}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-xs font-semibold">
                              {user.first_name[0]}{user.last_name[0]}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {user.first_name} {user.last_name}
                            </div>
                            <div className="text-xs text-white/60 truncate">
                              @{user.username}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedReferrer && (
                  <p className="text-xs text-white/60 flex items-center gap-1">
                    <UserIcon className="h-3 w-3" />
                    {selectedReferrer.first_name} will earn bonus points when you top up!
                  </p>
                )}
                <p className="text-xs text-white/40">
                  Optional: Search for the person who referred you
                </p>
              </div>
              )}

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
      </BaseDialogContent>
    </Dialog>
  )
}