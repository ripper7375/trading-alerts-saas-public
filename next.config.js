// Conditionally load bundle analyzer only when ANALYZE=true
// This prevents errors when @next/bundle-analyzer is not installed
const withBundleAnalyzer =
  process.env.ANALYZE === 'true'
    ? require('@next/bundle-analyzer')({ enabled: true })
    : (config) => config;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

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
      {
        protocol: 'https',
        hostname: '*.railway.app', // Railway deployments
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

  // Experimental & Optimization features for Next.js 16
  experimental: {
    // Enable server actions (stable in Next.js 15/16)
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Tree-shake heavy UI and icon libraries
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@radix-ui/react-icons',
      'date-fns',
    ],
  },

  // Transpile packages for Turbopack compatibility
  transpilePackages: ['ioredis'],

  // Turbopack configuration (Next.js bundler)
  turbopack: {},

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
            value: 'strict-origin-when-cross-origin',
          },
          // HSTS - Enforce HTTPS (1 year, include subdomains, preload ready)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // Permissions Policy - Restrict browser features
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // XSS Protection for legacy browsers
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Basic Content Security Policy
          // Note: Next.js requires 'unsafe-inline' and 'unsafe-eval' for scripts
          // A stricter CSP with nonces should be implemented for production
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.googleusercontent.com https://*.githubusercontent.com https://*.stripe.com",
              "font-src 'self' data:",
              "connect-src 'self' https://api.stripe.com https://checkout.stripe.com https://operation-service-production.up.railway.app wss://operation-service-production.up.railway.app https://*.vercel-analytics.com",
              "frame-src 'self' https://js.stripe.com https://checkout.stripe.com",
              "frame-ancestors 'self'",
              "form-action 'self'",
              "base-uri 'self'",
              "object-src 'none'",
            ].join('; '),
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
      // Session 6-2 (DECISION-LOG.md F62): app/admin/* merged into
      // app/(dashboard)/admin/*, retiring the standalone admin login page.
      // Every admin signs in through the standard /login flow now; the
      // (dashboard)/admin/layout.tsx role check still gates the panel.
      {
        source: '/admin/login',
        destination: '/login',
        permanent: true,
      },
    ];
  },

  // Exclude test and prisma packages from the bundle
  serverExternalPackages: [
    '@playwright/test',
    'playwright',
    'playwright-core',
    '@prisma/client',
    '@prisma/client-runtime-utils',
  ],

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
      config.externals.push(
        '@playwright/test',
        'playwright',
        'playwright-core'
      );
    }

    return config;
  },
};

module.exports = withBundleAnalyzer(nextConfig);
