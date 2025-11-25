const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Generate build ID for cache busting
  generateBuildId: async () => {
    // Use environment variable if set, otherwise generate from timestamp
    // In development, use timestamp for cache busting on every restart
    // In production, use build ID for stable versioning
    if (process.env.NEXT_PUBLIC_BUILD_ID) {
      return process.env.NEXT_PUBLIC_BUILD_ID
    }
    // Generate a unique build ID based on current time
    // This ensures cache busting on every build/restart
    return `build-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  },
  // Turbopack is enabled by default in Next.js 16 with --turbo flag
  // No need for experimental.turbo config
  
  // Performance optimizations
  reactStrictMode: true,
  
  // WebSocket support configuration for Stream.io
  // Bypass Next.js proxying for Stream.io WebSocket connections
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: []
    }
  },
  
  // Allow cross-origin requests in development for network access
  // Format: protocol://host or just host (Next.js will handle ports)
  allowedDevOrigins: process.env.NODE_ENV !== 'production' ? [
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'https://127.0.0.1:3000',
    'http://192.168.0.33:3000',
    'https://192.168.0.33:3000',
    'http://192.168.0.33',
    'https://192.168.0.33',
    '192.168.0.33',
    'http://10.76.78.173:3000',
    'https://10.76.78.173:3000',
    'http://10.76.78.173',
    'https://10.76.78.173',
    '10.76.78.173',
  ] : [],
  
  // Headers for WebSocket support and cache busting
  async headers() {
    return [
      // Global no-cache for all pages (except static assets)
      {
        source: '/:path*',
        headers: [
          {
            key: 'Connection',
            value: 'keep-alive',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      // Cache busting for service worker
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      // Cache busting for manifest
      {
        source: '/manifest.webmanifest',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0',
          },
        ],
      },
      // No cache for API routes
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0',
          },
        ],
      },
      // Long cache for static assets (immutable) - these are versioned by Next.js
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 0,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Turbopack is enabled by default in Next.js 16
  // Empty config confirms we're using Turbopack with its default optimizations
  turbopack: {},
  
  // Experimental features for performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-avatar', '@radix-ui/react-dialog'],
  },
}

module.exports = withBundleAnalyzer(nextConfig)