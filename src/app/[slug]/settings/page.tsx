import { redirect, notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import CommunitySettingsView from "./settings-view"

interface CommunitySettingsPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function CommunitySettingsPage({ params }: CommunitySettingsPageProps) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()
  
  // Fetch community data
  const { data: community, error } = await supabase
    .from('communities')
    .select(`
      id,
      name,
      slug,
      description,
      owner_id,
      plan_id,
      is_active,
      pricing_type,
      one_time_price,
      monthly_price,
      annual_price
    `)
    .eq('slug', slug)
    .single()

  if (error || !community) {
    notFound()
  }

  // Check if user is authenticated - MUST verify on server side
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  // Security check: Only owners can access settings
  // This check happens on the server, so it cannot be bypassed
  if (authError || !user) {
    console.log('Settings access denied: No authenticated user')
    redirect(`/${slug}`)
  }
  
  if (user.id !== community.owner_id) {
    console.log('Settings access denied: User is not the owner', {
      userId: user.id,
      ownerId: community.owner_id
    })
    redirect(`/${slug}`)
  }

  // User is confirmed to be the owner
  return (
    <CommunitySettingsView 
      community={community}
      isOwner={true}
    />
  )
}

