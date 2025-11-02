import { createServerSupabaseClient } from "@/lib/supabase-server"
import CommunitiesList from "./communities-list"

export default async function CommunitiesPage() {
  const supabase = await createServerSupabaseClient()
  
  // Fetch all active communities with their owners and member counts
  const { data: communities, error } = await supabase
    .from('communities')
    .select(`
      id,
      name,
      slug,
      description,
      created_at,
      is_active,
      owner:users(id, username, first_name, last_name)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching communities:', error)
  }

  // Fetch member counts for each community
  const communitiesWithCounts = await Promise.all(
    (communities || []).map(async (community: any) => {
      const { count } = await supabase
        .from('community_members')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', community.id)
      
      return {
        ...community,
        owner: Array.isArray(community.owner) ? community.owner[0] : community.owner,
        memberCount: count || 0
      }
    })
  )

  return <CommunitiesList communities={communitiesWithCounts} />
}

