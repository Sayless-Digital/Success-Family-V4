import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { env } from '@/lib/env'

// Generate Stream JWT token
function generateStreamToken(userId: string): string {
  const apiKey = env.GETSTREAM_API_KEY
  const apiSecret = env.GETSTREAM_API_SECRET

  if (!apiKey || !apiSecret) {
    throw new Error('GetStream API credentials not configured')
  }

  // Use require for jsonwebtoken (works better in Next.js API routes)
  const jwt = require('jsonwebtoken')

  // Stream JWT payload - for client-side tokens
  const payload = {
    user_id: userId,
  }

  // Sign token with Stream API secret
  // Note: GetStream tokens should NOT have noTimestamp - they need an exp claim
  const token = jwt.sign(payload, apiSecret, {
    algorithm: 'HS256',
    expiresIn: '1h', // Tokens expire in 1 hour
  })

  return token
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Generate Stream token
    const token = generateStreamToken(user.id)

    return NextResponse.json({ token })
  } catch (error: any) {
    console.error('Error generating Stream token:', error)
    console.error('Error stack:', error.stack)
    console.error('Environment check:', {
      hasApiKey: !!env.GETSTREAM_API_KEY,
      hasApiSecret: !!env.GETSTREAM_API_SECRET,
    })
    return NextResponse.json(
      { error: error.message || 'Failed to generate token' },
      { status: 500 }
    )
  }
}

