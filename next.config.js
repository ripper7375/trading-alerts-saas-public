const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Modular imports for better tree-shaking of icon libraries
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },

  // Image optimization configuration
  images: {
    // Allow images from these domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google OAuth profile images
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com', // GitHub OAuth profile images
      },
      {
        protocol: 'https',
        hostname: '*.vercel.app', // Vercel preview deployments
      },
    ],
    // Optimize images for faster loading
    formats: ['image/avif', 'image/webp'],
  },

  // Environment variables exposed to the browser (NEXT_PUBLIC_*)
  env: {
    // MT5 Service URL for client-side health checks (optional)
    // Actual API calls go through Next.js API routes
  },

  // Experimental features for Next.js 15
  experimental: {
    // Enable server actions (stable in Next.js 15)
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    // Disable x-powered-by header for security
    poweredByHeader: false,

    // Enable compression
    compress: true,

    // Generate source maps for error tracking (optional)
    productionBrowserSourceMaps: false,
  }),

  // Headers for security and caching
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
      {
        // Cache static assets
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Rewrites for API proxying (optional - if needed)
  async rewrites() {
    return [
      // Proxy MT5 health check to Flask service (optional)
      // This allows client-side health monitoring without exposing Flask URL
      // {
      //   source: '/api/mt5/health',
      //   destination: `${process.env.MT5_SERVICE_URL}/api/health`,
      // },
    ];
  },

  // Redirects for old routes or marketing (optional)
  async redirects() {
    return [
      // Example: Redirect old pricing page to new one
      // {
      //   source: '/pricing-old',
      //   destination: '/pricing',
      //   permanent: true,
      // },
    ];
  },

  // Exclude test packages from the bundle
  serverExternalPackages: ['@playwright/test', 'playwright', 'playwright-core'],

  // Webpack configuration (for advanced customization)
  webpack: (config, { isServer }) => {
    // Handle chart library (lightweight-charts) properly
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Exclude test/E2E packages from bundle
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push('@playwright/test', 'playwright', 'playwright-core');
    }

    return config;
  },
};

module.exports = withBundleAnalyzer(nextConfig);
