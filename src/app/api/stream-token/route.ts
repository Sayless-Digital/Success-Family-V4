import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-server'
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
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    // Generate Stream token
    const token = generateStreamToken(user.id)

    return NextResponse.json({ token })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate token'
    console.error('Error generating Stream token:', error)
    if (error instanceof Error) {
      console.error('Error stack:', error.stack)
    }
    console.error('Environment check:', {
      hasApiKey: !!env.GETSTREAM_API_KEY,
      hasApiSecret: !!env.GETSTREAM_API_SECRET,
    })
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

