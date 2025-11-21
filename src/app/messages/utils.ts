import type { ConversationListItem } from "@/lib/chat-shared"
import type { ViewerProfile } from "./types"

export function getDisplayName(profile: ViewerProfile | ConversationListItem["other_user_profile"]) {
  if (!profile) return "Unknown User"
  const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
  if (fullName.length > 0) return fullName
  if (profile.username) return `@${profile.username}`
  return "Unknown User"
}

export function getInitials(
  profile: ViewerProfile | ConversationListItem["other_user_profile"],
) {
  if (!profile) return "?"
  const first = profile.first_name?.[0]
  const last = profile.last_name?.[0]
  if (first || last) {
    return `${first ?? ""}${last ?? ""}`.toUpperCase()
  }
  return profile.username?.slice(0, 2)?.toUpperCase() ?? "?"
}

export function storagePathToObjectPath(storagePath: string | null | undefined) {
  if (!storagePath) return null
  const prefix = "dm-media/"
  if (storagePath.startsWith(prefix)) {
    return storagePath.slice(prefix.length)
  }
  return storagePath
}

export function formatTimestamp(iso?: string | null) {
  if (!iso) return ""
  const date = new Date(iso)
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}


