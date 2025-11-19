"use client"

import * as React from "react"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { env } from "@/lib/env"
import { toast } from "sonner"

const ONE_TAP_SCRIPT_ID = "google-one-tap-script"
const ONE_TAP_PARENT_ID = "google-one-tap-anchor"

interface GoogleCredentialResponse {
  credential?: string
  select_by?: string
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: Record<string, unknown>) => void
          prompt: (momentListener?: (notification: Record<string, unknown>) => void) => void
          cancel: () => void
        }
      }
    }
  }
}

export function GoogleOneTap() {
  const { user, isLoading } = useAuth()
  const clientId = env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const signingInRef = React.useRef(false)
  const promptTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const handleCredential = React.useCallback(async (response: GoogleCredentialResponse) => {
    if (!response?.credential || signingInRef.current) {
      return
    }

    signingInRef.current = true
    try {
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.credential,
      })

      if (error) {
        throw error
      }

      toast.success("Signed in with Google")
      window.google?.accounts?.id?.cancel()
    } catch (error) {
      console.error("[GoogleOneTap] Sign-in failed:", error)
      toast.error("Google sign in failed. Please try again.")

      // Allow another attempt
      signingInRef.current = false

      // Re-prompt after a short delay so users can try again
      if (typeof window !== "undefined") {
        if (promptTimeoutRef.current) {
          clearTimeout(promptTimeoutRef.current)
        }
        promptTimeoutRef.current = setTimeout(() => {
          if (!user) {
            window.google?.accounts?.id?.prompt()
          }
        }, 4000)
      }
      return
    }

    signingInRef.current = false
  }, [user])

  React.useEffect(() => {
    return () => {
      if (promptTimeoutRef.current) {
        clearTimeout(promptTimeoutRef.current)
      }
      promptTimeoutRef.current = null
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    if (!clientId || user || isLoading) {
      window.google?.accounts?.id?.cancel()
      return
    }

    const isSecureOrigin =
      window.location.protocol === "https:" || window.location.hostname === "localhost"

    if (!isSecureOrigin) {
      console.warn("[GoogleOneTap] One Tap requires HTTPS or localhost. Skipping initialization.")
      return
    }

    const initializeOneTap = () => {
      if (!window.google?.accounts?.id) {
        return
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
        context: "signin",
        prompt_parent_id: ONE_TAP_PARENT_ID,
        state_cookie_domain: window.location.hostname,
        use_fedcm_for_prompt: true,
      })

      window.google.accounts.id.prompt()
    }

    const existingScript = document.getElementById(ONE_TAP_SCRIPT_ID) as HTMLScriptElement | null
    let scriptElement: HTMLScriptElement | null = null

    if (window.google?.accounts?.id) {
      initializeOneTap()
    } else if (existingScript) {
      existingScript.addEventListener("load", initializeOneTap, { once: true })
    } else {
      scriptElement = document.createElement("script")
      scriptElement.id = ONE_TAP_SCRIPT_ID
      scriptElement.src = "https://accounts.google.com/gsi/client"
      scriptElement.async = true
      scriptElement.defer = true
      scriptElement.addEventListener("load", initializeOneTap, { once: true })
      document.head.appendChild(scriptElement)
    }

    return () => {
      window.google?.accounts?.id?.cancel()

      if (existingScript) {
        existingScript.removeEventListener("load", initializeOneTap)
      }

      if (scriptElement) {
        scriptElement.removeEventListener("load", initializeOneTap)
      }
    }
  }, [clientId, user, isLoading, handleCredential])

  if (!clientId) {
    return null
  }

  return null
}

