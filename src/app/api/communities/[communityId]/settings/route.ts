import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    const { communityId } = await params
    const supabase = await createServerSupabaseClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get request body
    const body = await request.json()
    const { name, description, logo_url, banner_url } = body

    // Verify user is community owner
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select('owner_id')
      .eq('id', communityId)
      .single()

    if (communityError) {
      return NextResponse.json(
        { error: 'Community not found' },
        { status: 404 }
      )
    }

    if (community.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Only community owners can update settings' },
        { status: 403 }
      )
    }

    // Prepare update data
    const updateData: {
      name?: string
      description?: string | null
      logo_url?: string | null
      banner_url?: string | null
    } = {}

    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description || null
    if (logo_url !== undefined) updateData.logo_url = logo_url || null
    if (banner_url !== undefined) updateData.banner_url = banner_url || null

    // Update community
    const { data: updatedCommunity, error: updateError } = await supabase
      .from('communities')
      .update(updateData)
      .eq('id', communityId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating community:', updateError)
      return NextResponse.json(
        { error: 'Failed to update community settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ community: updatedCommunity })
  } catch (error) {
    console.error('Error in PATCH /api/communities/[communityId]/settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}