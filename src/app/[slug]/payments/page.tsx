import { notFound, redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import CommunityPaymentsView from "./payments-view"

interface CommunityPaymentsPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function CommunityPaymentsPage({ params }: CommunityPaymentsPageProps) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()
  
  // Fetch community data
  const { data: community, error } = await supabase
    .from('communities')
    .select(`
      id,
      name,
      slug,
      owner_id
    `)
    .eq('slug', slug)
    .single()

  if (error || !community) {
    notFound()
  }

  // Check if user is authenticated and is the owner
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect(`/${slug}`)
  }
  
  if (user.id !== community.owner_id) {
    redirect(`/${slug}`)
  }

  return (
    <CommunityPaymentsView 
      communityId={community.id}
      communityName={community.name}
      ownerId={community.owner_id}
    />
  )
}

