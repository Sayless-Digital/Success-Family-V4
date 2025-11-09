"use client"

import * as React from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "dark",
  setTheme: () => null,
}

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "success-family-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(
    () => (typeof window !== "undefined" ? (localStorage.getItem(storageKey) as Theme) : defaultTheme) || defaultTheme
  )

  React.useEffect(() => {
    const root = window.document.documentElement
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const applyTheme = (resolvedTheme: "dark" | "light") => {
      root.classList.remove("light", "dark")
      root.classList.add(resolvedTheme)

      const metaThemeColor = window.document.querySelector('meta[name="theme-color"]')
      const color = "#000000"

      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", color)
      }

      root.style.backgroundColor = color
    }

    const resolvedTheme =
      theme === "system"
        ? (mediaQuery.matches ? "dark" : "light")
        : theme

    applyTheme(resolvedTheme)

    if (theme !== "system") {
      return
    }

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      applyTheme(event.matches ? "dark" : "light")
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange)

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange)
    }
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}