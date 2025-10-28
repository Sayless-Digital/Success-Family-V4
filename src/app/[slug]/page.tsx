import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import CommunityView from "./community-view"

interface CommunityPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function CommunityPage({ params }: CommunityPageProps) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()
  
  // Fetch community data
  const { data: community, error } = await supabase
    .from('communities')
    .select(`
      *,
      owner:users!communities_owner_id_fkey(id, username, first_name, last_name, profile_picture),
      plan:subscription_plans(name, monthly_price, annual_price),
      members:community_members(
        id,
        role,
        joined_at,
        user:users(id, username, first_name, last_name, profile_picture)
      )
    `)
    .eq('slug', slug)
    .single()
  
  // Add pricing fields to community
  const communityWithPricing = community ? {
    ...community,
    pricing_type: community.pricing_type,
    one_time_price: community.one_time_price,
    monthly_price: community.monthly_price,
    annual_price: community.annual_price,
  } : null

  if (error) {
    console.error('Community fetch error:', JSON.stringify(error, null, 2))
    console.error('Error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    notFound()
  }

  if (!communityWithPricing) {
    console.error('No community found for slug:', slug)
    notFound()
  }

  // Check if user is authenticated and get their membership status
  const { data: { user } } = await supabase.auth.getUser()
  
  let userMembership = null
  let paymentStatus = null
  
  if (user) {
    // Check if user is a member
    const membership = communityWithPricing.members?.find((m: any) => m.user.id === user.id)
    if (membership) {
      userMembership = membership
    }
    
    // Get latest payment receipt status if user is owner
    if (communityWithPricing.owner_id === user.id) {
      const { data: receipt } = await supabase
        .from('payment_receipts')
        .select('status, created_at, rejection_reason')
        .eq('community_id', communityWithPricing.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      paymentStatus = receipt
    }
  }

  return (
    <CommunityView 
      community={communityWithPricing} 
      userMembership={userMembership}
      paymentStatus={paymentStatus}
      currentUserId={user?.id}
    />
  )
}