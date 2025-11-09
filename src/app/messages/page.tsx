import { redirect } from "next/navigation"

import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getConversationSummaries, listMessages } from "@/lib/chat"
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

  const initialThread = conversations[0] ?? null
  const initialThreadId = initialThread?.thread_id ?? null

  const initialMessagesByThread: Record<string, Awaited<ReturnType<typeof listMessages>>> = {}
  const initialPaginationByThread: Record<string, { hasMore: boolean; nextCursor: string | null }> = {}

  if (initialThreadId) {
    const messages = await listMessages(supabase, initialThreadId, 50)
    const ordered = [...messages].reverse()
    initialMessagesByThread[initialThreadId] = ordered
    initialPaginationByThread[initialThreadId] = {
      hasMore: messages.length === 50,
      nextCursor: messages.length === 50 ? messages[messages.length - 1]?.created_at ?? null : null,
    }
  }

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

