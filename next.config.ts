import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Disable server-side optimization — images come directly from CDN
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async rewrites() {
    const isProd = process.env.NODE_ENV === "production";
    const rawApiUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      (isProd ? "https://chillers.onrender.com/api" : "http://localhost:4000/api");
    const backendUrl = rawApiUrl.replace(/\/api\/?$/, "");
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          // Allow iframes from streaming providers
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com",
              "frame-src 'self' https://vidlink.pro https://vidapi.xyz https://doodstream.com https://d0000d.com https://www.youtube.com https://animekai.to https://*.vidzy.cc https://vidsrc.xyz https://embed.su https://playmogo.com",
              "media-src 'self' blob: data: https://*.vidzy.cc https://vidlink.pro https://vidapi.xyz",
              "img-src 'self' data: blob: https://image.tmdb.org https://images.unsplash.com https://*.tmdb.org https://*.vidzy.cc",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "connect-src 'self' http://localhost:4000 https://chillers.onrender.com https://api.themoviedb.org",
              "font-src 'self' data:",
            ].join('; '),
          },
          // Don't block the page from being used normally
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Allow fullscreen API on mobile
          {
            key: 'Permissions-Policy',
            value: 'autoplay=*, fullscreen=*, picture-in-picture=*, gyroscope=*, accelerometer=*',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
