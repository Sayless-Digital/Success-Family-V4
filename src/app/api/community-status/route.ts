import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getCommunityBySlug } from "@/lib/community-cache"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json({ isOwner: false, isMember: false }, { status: 200 })
    }

    const supabase = await createServerSupabaseClient()
    
    // Fetch community data (cached)
    const community = await getCommunityBySlug(slug)
    if (!community) {
      return NextResponse.json({ isOwner: false, isMember: false }, { status: 200 })
    }

    // Get user and check owner/member status
    const { data: { user } } = await supabase.auth.getUser()
    
    let isOwner = false
    let isMember = false

    if (user) {
      isOwner = community.owner_id === user.id
      
      // Quick check if user is a member (only if not owner, since owners are always members)
      if (!isOwner) {
        const { data: membership } = await supabase
          .from('community_members')
          .select('id')
          .eq('community_id', community.id)
          .eq('user_id', user.id)
          .maybeSingle()
        
        isMember = !!membership
      } else {
        // Owners are always members
        isMember = true
      }
    }

    return NextResponse.json({ isOwner, isMember }, { status: 200 })
  } catch (error) {
    console.error('Error in community-status API:', error)
    return NextResponse.json({ isOwner: false, isMember: false }, { status: 200 })
  }
}


