"use server"

import type { SupabaseClient } from "@supabase/supabase-js"

import { createServerSupabaseClient } from "@/lib/supabase-server"
import type { Database, DirectMessageThread, UserFollow, UserFollowStats } from "@/types"
import { createNotification } from "@/lib/notifications"

type TypedSupabaseClient = SupabaseClient<Database>

export interface FollowStatus {
  isFollowing: boolean
  isFollowedBy: boolean
  isMutual: boolean
}

export interface FollowCounts {
  followers: number
  following: number
}

export async function getServerSupabaseClient() {
  return createServerSupabaseClient() as Promise<TypedSupabaseClient>
}

export async function getFollowStatus(
  supabase: TypedSupabaseClient,
  viewerId: string,
  targetUserId: string,
): Promise<FollowStatus> {
  if (!viewerId || !targetUserId || viewerId === targetUserId) {
    return {
      isFollowing: false,
      isFollowedBy: false,
      isMutual: false,
    }
  }

  const client = supabase as SupabaseClient<any>

  const [following, followedBy] = await Promise.all([
    client
      .from("user_follows")
      .select("follower_id")
      .eq("follower_id", viewerId)
      .eq("followed_id", targetUserId)
      .maybeSingle(),
    client
      .from("user_follows")
      .select("follower_id")
      .eq("follower_id", targetUserId)
      .eq("followed_id", viewerId)
      .maybeSingle(),
  ])

  if (following.error) {
    throw following.error
  }

  if (followedBy.error) {
    throw followedBy.error
  }

  const isFollowing = !!following.data
  const isFollowedBy = !!followedBy.data

  return {
    isFollowing,
    isFollowedBy,
    isMutual: isFollowing && isFollowedBy,
  }
}

export async function followUser(
  supabase: TypedSupabaseClient,
  followerId: string,
  targetUserId: string,
): Promise<UserFollow | null> {
  if (!followerId || !targetUserId || followerId === targetUserId) {
    throw new Error("Invalid follow target")
  }

  const client = supabase as SupabaseClient<any>

  const { data, error } = await client
    .from("user_follows")
    .upsert(
      {
        follower_id: followerId,
        followed_id: targetUserId,
      },
      { onConflict: "follower_id,followed_id" },
    )
    .select("*")
    .maybeSingle()

  if (error) {
    throw error
  }

  // Notify the followed user about the new follower (fire and forget - non-critical)
  if (data) {
    void (async () => {
      try {
        // Get follower's profile for notification
        const { data: followerProfile } = await client
          .from("users")
          .select("username, first_name, last_name")
          .eq("id", followerId)
          .single()

        const followerName = followerProfile
          ? `${followerProfile.first_name} ${followerProfile.last_name}`.trim() || followerProfile.username
          : "Someone"

        // Create notification for the followed user
        await createNotification({
          userId: targetUserId,
          type: "follow",
          title: "New follower",
          body: `${followerName} started following you`,
          actionUrl: `/profile/${followerProfile?.username || followerId}`,
          metadata: {
            follower_id: followerId,
            follower_name: followerName,
            follower_username: followerProfile?.username,
          }
        })
      } catch (error) {
        console.error("[followUser] Error creating follow notification:", error)
        // Non-critical error - don't fail the follow operation
      }
    })()
  }

  return (data as UserFollow) ?? null
}

export async function unfollowUser(
  supabase: TypedSupabaseClient,
  followerId: string,
  targetUserId: string,
) {
  if (!followerId || !targetUserId || followerId === targetUserId) {
    throw new Error("Invalid unfollow target")
  }

  const client = supabase as SupabaseClient<any>

  const { error } = await client
    .from("user_follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("followed_id", targetUserId)

  if (error) {
    throw error
  }
}

export async function getFollowCounts(
  supabase: TypedSupabaseClient,
  userIds: string[],
): Promise<Record<string, FollowCounts>> {
  if (userIds.length === 0) {
    return {}
  }

  const client = supabase as SupabaseClient<any>

  const { data, error } = await client
    .from("user_follow_stats")
    .select("user_id, followers_count, following_count")
    .in("user_id", userIds)

  if (error) {
    throw error
  }

  const counts: Record<string, FollowCounts> = {}
  for (const raw of data ?? []) {
    const row = raw as UserFollowStats
    counts[row.user_id] = {
      followers: Number(row.followers_count ?? 0),
      following: Number(row.following_count ?? 0),
    }
  }

  return counts
}

