import { cache } from "react"
import { createServerSupabaseClient } from "./supabase-server"

/**
 * Cached community data fetcher
 * Uses React cache() to deduplicate requests within the same render
 * This makes navigation between community pages instant since community data is cached
 */
export const getCommunityBySlug = cache(async (slug: string) => {
  const supabase = await createServerSupabaseClient()
  
  const { data: community, error } = await supabase
    .from('communities')
    .select(`
      id,
      name,
      slug,
      description,
      owner_id,
      owner:users!communities_owner_id_fkey(id, username, first_name, last_name, profile_picture)
    `)
    .eq('slug', slug)
    .maybeSingle()

  if (error || !community) {
    return null
  }

  return community
})







