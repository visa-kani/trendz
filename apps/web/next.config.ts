import type { NextConfig } from "next";

/**
 * The browser always talks to the API through this origin (/api/*), so auth
 * cookies are first-party. In production Nginx routes /api straight to the
 * Express API; this rewrite covers local development and `next start`.
 */
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4100";
// Where stored pictures are shown from and uploaded to: one origin, or several separated by spaces
// (Cloudinary shows pictures from res.cloudinary.com and takes uploads at api.cloudinary.com).
const MEDIA_ORIGIN = (process.env.NEXT_PUBLIC_MEDIA_ORIGIN ?? "http://localhost:9100").split(/[\s,]+/).filter(Boolean).join(" ");
const isProd = process.env.NODE_ENV === "production";

const csp = [
  "default-src 'self'",
  // Razorpay Checkout is loaded from its CDN and opens in an iframe.
  `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src 'self' data: blob: ${MEDIA_ORIGIN} https://*.razorpay.com`,
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' ${MEDIA_ORIGIN} https://*.razorpay.com${isProd ? "" : " ws: http://localhost:*"}`,
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Product images are already optimised to WebP/AVIF sizes and served by image storage (R2 or Cloudinary) and its CDN.
  images: { unoptimized: true },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_INTERNAL_URL}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // The POS needs the camera for scanning; nothing else does.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\")" },
        ],
      },
    ];
  },
};

export default config;
