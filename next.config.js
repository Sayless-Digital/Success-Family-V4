/** @type {import('next').NextConfig} */
const nextConfig = {
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
  ] : [],
  
  // Headers for WebSocket support
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Connection',
            value: 'keep-alive',
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
    minimumCacheTTL: 60,
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

module.exports = nextConfig
