import type { NextConfig } from "next";

/**
 * Content Security Policy.
 *
 * Next.js inlines a small runtime script and Tailwind emits no inline styles in
 * production, so the only concessions are `unsafe-inline` for styles (required
 * by React's style injection) and `'self'` everywhere else. Payment provider
 * origins are added explicitly when a provider is configured, rather than
 * opening the policy to all of `https:`.
 */
const paymentOrigins = [
  "https://api.razorpay.com",
  "https://checkout.razorpay.com",
  "https://js.stripe.com",
  "https://api.stripe.com",
];

const contentSecurityPolicy = [
  `default-src 'self'`,
  // `unsafe-eval` is needed by the React refresh runtime in development only.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} ${paymentOrigins.join(" ")}`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com data:`,
  `img-src 'self' blob: data: https:`,
  `connect-src 'self' ${paymentOrigins.join(" ")}`,
  `frame-src 'self' ${paymentOrigins.join(" ")}`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `upgrade-insecure-requests`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // The seeded demonstration database is opened at runtime, not imported, so
  // nothing traces a dependency on it and it would be left out of the bundle.
  // Harmless when absent — a real deployment never builds one.
  outputFileTracingIncludes: {
    "/**": [".pglite-demo/**"],
  },

  reactStrictMode: true,

  // Native modules and WebAssembly engines must not be traced into the bundle.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "pglite-prisma-adapter",
    "@prisma/adapter-pg",
    "pg",
    "sharp",
  ],

  images: {
    // AVIF first, WebP as the fallback; the browser picks by Accept header.
    formats: ["image/avif", "image/webp"],
    // Widths matched to the actual layouts: the listing grid never needs a
    // 3840px source, and shipping one is a Core Web Vitals problem.
    deviceSizes: [420, 640, 828, 1080, 1200, 1600, 1920, 2560],
    imageSizes: [64, 96, 128, 200, 256, 384, 512],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      // Object storage / CDN for member-uploaded photography. Narrow this to
      // your bucket hostname in production.
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.cloudfront.net" },
    ],
  },

  experimental: {
    // Only pull the icons actually referenced, rather than the whole set.
    optimizePackageImports: ["lucide-react", "motion", "date-fns"],
  },

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Generated photography is content-addressed and immutable.
        source: "/photography/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },

  async redirects() {
    return [
      // Legacy query-string product URLs are permanently superseded by
      // /item/[slug]; keeping the redirect preserves any inbound links.
      { source: "/product", destination: "/shop", permanent: true },
    ];
  },
};

export default nextConfig;
