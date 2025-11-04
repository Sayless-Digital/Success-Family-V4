/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack is enabled by default in Next.js 16 with --turbo flag
  // No need for experimental.turbo config
  
  // Performance optimizations
  reactStrictMode: true,
  
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
  
  // Bundle optimization
  webpack: (config, { isServer }) => {
    // Optimize for production
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunk for node_modules
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20
            },
            // Common chunk for shared code
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true
            },
            // React chunk
            react: {
              name: 'react',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              priority: 30
            },
            // Three.js chunk (for Silk animation)
            three: {
              name: 'three',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](three|@react-three)[\\/]/,
              priority: 25
            }
          }
        }
      };
    }
    
    return config;
  },
  
  // Experimental features for performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-avatar', '@radix-ui/react-dialog'],
  },
}

module.exports = nextConfig
