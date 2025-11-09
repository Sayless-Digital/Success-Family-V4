import { PostgrestError } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import type { HierarchicalPost, PostWithAuthor } from "@/types"

export interface CreatePostInput {
  communityId: string
  authorId: string
  content: string
  parentPostId?: string | null
  publishedAt?: string
}

export async function insertPost(input: CreatePostInput): Promise<PostWithAuthor> {
  const { communityId, authorId, content, parentPostId, publishedAt } = input

  const { data, error } = await supabase
    .from("posts")
    .insert({
      community_id: communityId,
      author_id: authorId,
      content,
      parent_post_id: parentPostId ?? null,
      published_at: publishedAt ?? new Date().toISOString(),
    })
    .select(
      `
        *,
        author:users!posts_author_id_fkey(
          id,
          username,
          first_name,
          last_name,
          profile_picture
        ),
        media:post_media(
          id,
          media_type,
          storage_path,
          file_name,
          display_order
        )
      `,
    )
    .single()

  if (error) {
    throw error
  }

  return data as PostWithAuthor
}

export async function fetchCommentsWithReplies(postId: string, userId?: string): Promise<HierarchicalPost[]> {
  // Fetch comments (depth 1)
  const { data: comments, error: commentsError } = await supabase
    .from("posts")
    .select(
      `
        *,
        author:users!posts_author_id_fkey(
          id,
          username,
          first_name,
          last_name,
          profile_picture
        ),
        media:post_media(
          id,
          media_type,
          storage_path,
          file_name,
          display_order
        )
      `,
    )
    .eq("parent_post_id", postId)
    .eq("depth", 1)
    .order("created_at", { ascending: true })

  if (commentsError) {
    throw commentsError
  }

  if (!comments || comments.length === 0) {
    return []
  }

  // Fetch replies (depth 2)
  const commentIds = comments.map(c => c.id)
  const { data: replies, error: repliesError } = await supabase
    .from("posts")
    .select(
      `
        *,
        author:users!posts_author_id_fkey(
          id,
          username,
          first_name,
          last_name,
          profile_picture
        ),
        media:post_media(
          id,
          media_type,
          storage_path,
          file_name,
          display_order
        )
      `,
    )
    .in("parent_post_id", commentIds)
    .eq("depth", 2)
    .order("created_at", { ascending: true })

  if (repliesError) {
    throw repliesError
  }

  // Group replies by parent comment
  const repliesByParent = new Map<string, PostWithAuthor[]>()
  if (replies) {
    for (const reply of replies as (PostWithAuthor & { parent_post_id: string | null })[]) {
      if (!reply.parent_post_id) continue
      const list = repliesByParent.get(reply.parent_post_id) ?? []
      list.push(reply)
      repliesByParent.set(reply.parent_post_id, list)
    }
  }

  // Attach replies to comments
  const hierarchicalComments: HierarchicalPost[] = comments.map(comment => ({
    ...comment,
    replies: repliesByParent.get(comment.id) ?? []
  })) as HierarchicalPost[]

  return hierarchicalComments
}
export async function fetchCommentsForPosts(
  postIds: string[],
  userId?: string,
): Promise<Record<string, HierarchicalPost[]>> {
  if (postIds.length === 0) {
    return {}
  }

  try {
    return await fetchCommentsForPostsInternal(postIds, userId)
  } catch (error: unknown) {
    if (isRelationshipSchemaError(error)) {
      console.warn(
        "Falling back to per-post comment fetch due to relationship cache error:",
        error,
      )

      return await fetchCommentsForPostsFallback(postIds, userId)
    }

    throw error
  }
}

function isRelationshipSchemaError(error: unknown): error is PostgrestError {
  if (!error || typeof error !== "object") {
    return false
  }

  const err = error as PostgrestError
  return err.code === "PGRST200" || err.message?.toLowerCase().includes("relationship")
}

async function fetchCommentsForPostsInternal(
  postIds: string[],
  userId?: string,
): Promise<Record<string, HierarchicalPost[]>> {
  const chunk = <T,>(items: T[], size: number) => {
    const result: T[][] = []
    for (let i = 0; i < items.length; i += size) {
      result.push(items.slice(i, i + size))
    }
    return result
  }

  const commentChunks = chunk(postIds, 15)
  const commentSelect = `
    *,
    author:users!posts_author_id_fkey(
      id,
      username,
      first_name,
      last_name,
      profile_picture
    ),
    media:post_media(
      id,
      media_type,
      storage_path,
      file_name,
      display_order
    )
  `

  const commentResponses = await Promise.all(
    commentChunks.map((ids) =>
      supabase
        .from("posts")
        .select(commentSelect)
        .in("parent_post_id", ids)
        .order("created_at", { ascending: true }),
    ),
  )

  const comments: (PostWithAuthor & { parent_post_id: string | null })[] = []

  for (const { data, error } of commentResponses) {
    if (error) {
      throw error
    }

    if (data) {
      comments.push(...(data as (PostWithAuthor & { parent_post_id: string | null })[]))
    }
  }

  if (comments.length === 0) {
    return {}
  }

  const commentIds = comments.map((comment) => comment.id)
  const replyChunks = chunk(commentIds, 25)

  const replySelect = `
    *,
    author:users!posts_author_id_fkey(
      id,
      username,
      first_name,
      last_name,
      profile_picture
    ),
    media:post_media(
      id,
      media_type,
      storage_path,
      file_name,
      display_order
    )
  `

  const replyResponses = await Promise.all(
    replyChunks.map((ids) =>
      supabase
        .from("posts")
        .select(replySelect)
        .in("parent_post_id", ids)
        .order("created_at", { ascending: true }),
    ),
  )

  const repliesByParent = new Map<string, PostWithAuthor[]>()

  for (const { data, error } of replyResponses) {
    if (error) {
      throw error
    }

    if (data) {
      for (const reply of data as (PostWithAuthor & { parent_post_id: string | null })[]) {
        if (!reply.parent_post_id) continue
        const list = repliesByParent.get(reply.parent_post_id) ?? []
        list.push(reply)
        repliesByParent.set(reply.parent_post_id, list)
      }
    }
  }

  return await enrichAndGroupComments(comments, repliesByParent, userId)
}

async function fetchCommentsForPostsFallback(
  postIds: string[],
  userId?: string,
): Promise<Record<string, HierarchicalPost[]>> {
  const comments: (PostWithAuthor & { parent_post_id: string | null })[] = []
  const repliesByParent = new Map<string, PostWithAuthor[]>()

  const results = await Promise.all(
    postIds.map(async (postId) => {
      const fallbackComments = await fetchCommentsWithReplies(postId, userId)
      return { postId, comments: fallbackComments }
    }),
  )

  for (const { comments: commentList } of results) {
    for (const comment of commentList) {
      const { replies = [], ...commentWithoutReplies } = comment

      comments.push(commentWithoutReplies as PostWithAuthor & { parent_post_id: string | null })

      if (replies.length > 0) {
        repliesByParent.set(comment.id, replies)
      }
    }
  }

  if (comments.length === 0) {
    return {}
  }

  return await enrichAndGroupComments(comments, repliesByParent, userId)
}

async function enrichAndGroupComments(
  comments: (PostWithAuthor & { parent_post_id: string | null })[],
  repliesByParent: Map<string, PostWithAuthor[]>,
  userId?: string,
): Promise<Record<string, HierarchicalPost[]>> {
  const replyList = Array.from(repliesByParent.values())
  const replyIds = replyList.flatMap((replies) => replies.map((reply) => reply.id))
  const allIds = [...new Set([...comments.map((comment) => comment.id), ...replyIds])]

  const boostCountMap = new Map<string, number>()
  const boostStatusMap = new Map<string, { user_has_boosted: boolean; can_unboost: boolean }>()

  if (allIds.length > 0) {
    const { data: boostCounts } = await supabase.rpc("get_posts_boost_counts", {
      p_post_ids: allIds,
    })

    ;(boostCounts || []).forEach((entry: { post_id: string; boost_count: number }) => {
      boostCountMap.set(entry.post_id, entry.boost_count)
    })

    if (userId) {
      const { data: boostStatuses } = await supabase.rpc("get_user_boosted_posts", {
        p_post_ids: allIds,
        p_user_id: userId,
      })

      ;(boostStatuses || []).forEach(
        (entry: { post_id: string; user_has_boosted: boolean; can_unboost: boolean }) => {
          boostStatusMap.set(entry.post_id, {
            user_has_boosted: entry.user_has_boosted,
            can_unboost: entry.can_unboost,
          })
        },
      )
    }
  }

  const grouped: Record<string, HierarchicalPost[]> = {}

  comments.forEach((comment) => {
    const parentId = comment.parent_post_id
    if (!parentId) return

    const replies = (repliesByParent.get(comment.id) ?? []).map((reply) => ({
      ...reply,
      boost_count: boostCountMap.get(reply.id) ?? 0,
      user_has_boosted: boostStatusMap.get(reply.id)?.user_has_boosted ?? false,
      can_unboost: boostStatusMap.get(reply.id)?.can_unboost ?? false,
    }))

    const enrichedComment: HierarchicalPost = {
      ...comment,
      boost_count: boostCountMap.get(comment.id) ?? 0,
      user_has_boosted: boostStatusMap.get(comment.id)?.user_has_boosted ?? false,
      can_unboost: boostStatusMap.get(comment.id)?.can_unboost ?? false,
      replies,
    }

    if (!grouped[parentId]) {
      grouped[parentId] = []
    }

    grouped[parentId].push(enrichedComment)
  })

  return grouped
}


