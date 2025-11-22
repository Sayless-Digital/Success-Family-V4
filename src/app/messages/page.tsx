import { redirect } from "next/navigation"

import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getConversationSummaries } from "@/lib/chat"
import type { MessageResult } from "@/lib/chat-shared"
import MessagesView from "./messages-view"

export default async function MessagesPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/?signin=1")
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, username, first_name, last_name, profile_picture")
    .eq("id", user.id)
    .maybeSingle()

  const conversations = await getConversationSummaries(supabase, user.id, {
    limit: 30,
  })

  // Don't auto-select the first conversation - let user choose
  const initialThreadId = null

  const initialMessagesByThread: Record<string, MessageResult[]> = {}
  const initialPaginationByThread: Record<string, { hasMore: boolean; nextCursor: string | null }> = {}

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <MessagesView
        viewer={{
          id: user.id,
          username: profile?.username ?? null,
          first_name: profile?.first_name ?? null,
          last_name: profile?.last_name ?? null,
          profile_picture: profile?.profile_picture ?? null,
        }}
        initialConversations={conversations}
        initialThreadId={initialThreadId}
        initialMessagesByThread={initialMessagesByThread}
        initialPaginationByThread={initialPaginationByThread}
      />
    </div>
  )
}

