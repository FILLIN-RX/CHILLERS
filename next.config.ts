import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://vercel.live https://pagead2.googlesyndication.com https://*.googlesyndication.com https://googleads.g.doubleclick.net https://*.googleadservices.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://*.adtrafficquality.google",
              "frame-src 'self' https://vidlink.pro https://vidapi.xyz https://doodstream.com https://*.doodstream.com https://d000d.com https://*.d000d.com https://d0000d.com https://playmogo.com https://*.playmogo.com https://*.dood.to https://www.youtube.com https://animekai.to https://*.vidzy.cc https://vidsrc.xyz https://embed.su https://uqload.is https://*.uqload.is https://www.google.com https://*.google.com https://vercel.live https://googleads.g.doubleclick.net https://*.googlesyndication.com https://*.doubleclick.net https://*.googleadservices.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://*.adtrafficquality.google",
              "media-src 'self' blob: data: https://*.vidzy.cc https://vidlink.pro https://vidapi.xyz https://*.uqload.is https://*.gstatic.com https://s0.2mdn.net https://*.amagi.tv https://*.france24.com https://*.lcp.fr https://*.yacast.fr https://*.getaj.net https://*.wurl.com https://*.ott.tv5monde.com https://*.akamaized.net https://*.pluto.tv https://*.cloudfront.net",
              "img-src 'self' data: blob: https://image.tmdb.org https://images.unsplash.com https://*.tmdb.org https://*.vidzy.cc https://*.gstatic.com https://s0.2mdn.net https://vercel.live https://vercel.com https://*.googlesyndication.com https://*.googleadservices.com https://*.doubleclick.net https://*.googleusercontent.com https://*.i.ibb.co https://upload.wikimedia.org https://i.imgur.com https://jiotvimages.cdn.jio.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://*.adtrafficquality.google",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "connect-src 'self' http://localhost:4000 https://chillers.onrender.com https://api.themoviedb.org https://*.uqload.is https://pagead2.googlesyndication.com https://ep1.adtrafficquality.google https://*.adtrafficquality.google https://*.amagi.tv https://*.france24.com https://*.lcp.fr https://*.yacast.fr https://*.getaj.net https://*.wurl.com https://*.ott.tv5monde.com https://*.akamaized.net https://*.pluto.tv https://*.cloudfront.net https://*.nhkworld.jp http://amdlive-ch01.ctnd.com.edgesuite.net wss://tracker.webtorrent.dev wss://tracker.openwebtorrent.com https://tracker.openwebtorrent.com wss://tracker.btorrent.xyz wss://tracker.files.fm:7073 https://tracker.opentrackr.org:1337/announce",
              "font-src 'self' data: https://vercel.live",
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
            value: 'autoplay=*, fullscreen=*, picture-in-picture=*, encrypted-media=*, gyroscope=*, accelerometer=*',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
