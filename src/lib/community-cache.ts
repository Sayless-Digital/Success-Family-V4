import { createServerSupabaseClient } from "./supabase-server"

/**
 * Fetches community data by slug without caching to ensure the latest content is returned.
 */
export const getCommunityBySlug = async (slug: string) => {
  const supabase = await createServerSupabaseClient()
  
  const { data: community, error } = await supabase
    .from('communities')
    .select(`
      id,
      name,
      slug,
      description,
      is_active,
      logo_url,
      owner_id,
      owner:users!communities_owner_id_fkey(id, username, first_name, last_name, profile_picture)
    `)
    .eq('slug', slug)
    .maybeSingle()

  if (error || !community) {
    return null
  }

  return community
}