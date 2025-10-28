import { createServerSupabaseClient } from "@/lib/supabase-server"
import { notFound, redirect } from "next/navigation"
import ProfileView from "./profile-view"

interface PageProps {
  params: Promise<{ username: string }>
}

export default async function ProfilePage(props: PageProps) {
  const params = await props.params
  const username = params.username
  
  if (!username) {
    redirect('/')
  }

  const supabase = await createServerSupabaseClient()

  // Fetch user profile by username
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single()

  if (error || !user) {
    notFound()
  }

  // Count user's communities (as owner)
  const { count: ownedCommunitiesCount } = await supabase
    .from('communities')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', user.id)
    .eq('is_active', true)

  // Count user's community memberships
  const { count: memberCommunitiesCount } = await supabase
    .from('community_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Count user's verified payments
  const { count: verifiedPaymentsCount } = await supabase
    .from('payment_receipts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'verified')

  return (
    <ProfileView
      user={user}
      ownedCommunitiesCount={ownedCommunitiesCount || 0}
      memberCommunitiesCount={memberCommunitiesCount || 0}
      verifiedPaymentsCount={verifiedPaymentsCount || 0}
    />
  )
}

