import { ClientLayoutWrapper } from "./client-layout-wrapper"

interface GlobalLayoutProps {
  children: React.ReactNode
}

/**
 * Server Component wrapper for layout
 * Client interactivity handled by ClientLayoutWrapper
 */
export function GlobalLayout({ children }: GlobalLayoutProps) {
  return <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
}
