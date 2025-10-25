import { NextResponse } from 'next/server'

// Return empty response for service worker requests
// This prevents 404 errors when browsers automatically request /sw.js
export async function GET() {
  return new NextResponse(null, { status: 204 })
}