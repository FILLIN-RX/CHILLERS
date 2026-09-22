import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  experimental: {
    optimizePackageImports: [
      '@phosphor-icons/react',
      'antd',
      '@mantine/core',
      '@mantine/hooks',
      'gsap',
    ],
  },
  images: {
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "img.static-ottera.com" },
      { protocol: "https", hostname: "img2.static-ottera.com" },
      { protocol: "https", hostname: "cdnapisec.kaltura.com" },
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
        source: '/api/nextauth/:path*',
        destination: '/api/nextauth/:path*',
      },
      {
        source: '/api/auth/signin/:path*',
        destination: '/api/nextauth/signin/:path*',
      },
      {
        source: '/api/auth/callback/:path*',
        destination: '/api/nextauth/callback/:path*',
      },
      {
        source: '/api/auth/session',
        destination: '/api/nextauth/session',
      },
      {
        source: '/api/auth/csrf',
        destination: '/api/nextauth/csrf',
      },
      {
        source: '/api/auth/providers',
        destination: '/api/nextauth/providers',
      },
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://vercel.live https://pagead2.googlesyndication.com https://*.googlesyndication.com https://googleads.g.doubleclick.net https://*.googleadservices.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://*.adtrafficquality.google https://js.pusher.com https://*.pusher.com",
              "frame-src 'self' https://liveball.sx https://*.liveball.sx https://liveball.im https://*.liveball.im https://vidlink.pro https://*.vidlink.pro https://vidapi.xyz https://*.vidapi.xyz https://doodstream.com https://*.doodstream.com https://d000d.com https://*.d000d.com https://d0000d.com https://*.d0000d.com https://playmogo.com https://*.playmogo.com https://*.dood.to https://*.dood.so https://*.dood.cx https://*.dood.la https://*.dood.ws https://*.dood.sh https://*.dood.watch https://*.ds2play.com https://*.ds2video.com https://www.youtube.com https://animekai.to https://vidzy.cc https://*.vidzy.cc http://vidzy.cc http://*.vidzy.cc https://luluvid.com https://*.luluvid.com https://fsvid.lol https://*.fsvid.lol https://trakx.lol https://*.trakx.lol https://vidsrc.in https://*.vidsrc.in https://vidsrc.xyz https://*.vidsrc.xyz https://embed.su https://*.embed.su https://uqload.is https://*.uqload.is https://uqload.vc https://*.uqload.vc https://uqload.ws https://*.uqload.ws https://uqload.to https://*.uqload.to https://uqload.co https://*.uqload.co https://uqload.net https://*.uqload.net https://uqload.com https://*.uqload.com https://uqload.io https://*.uqload.io https://streamtape.com https://*.streamtape.com https://www.google.com https://*.google.com https://vercel.live https://googleads.g.doubleclick.net https://*.googlesyndication.com https://*.doubleclick.net https://*.googleadservices.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://*.adtrafficquality.google https://luluvdo.com https://*.luluvdo.com https://vidmoly.org https://*.vidmoly.org https://savefiles.com https://*.savefiles.com https://waaw1.tv https://*.waaw1.tv https://vidara.to https://*.vidara.to https://morencius.com https://*.morencius.com https://hanerix.com https://*.hanerix.com https://firestream.site https://*.firestream.site https://tipfly.xyz https://*.tipfly.xyz https://rebeccapracticeloss.com https://*.rebeccapracticeloss.com",
              "media-src 'self' blob: data: https: http: https://vidzy.cc https://*.vidzy.cc http://vidzy.cc http://*.vidzy.cc https://luluvid.com https://*.luluvid.com https://vidlink.pro https://*.vidlink.pro https://vidapi.xyz https://*.vidapi.xyz https://*.uqload.is https://*.uqload.vc https://*.uqload.ws https://*.uqload.to https://*.uqload.co https://*.uqload.net https://*.uqload.com https://*.uqload.io https://*.gstatic.com https://s0.2mdn.net https://*.amagi.tv https://*.france24.com https://*.lcp.fr https://*.yacast.fr https://*.getaj.net https://*.wurl.com https://*.ott.tv5monde.com https://*.akamaized.net https://*.pluto.tv https://*.cloudfront.net https://*.hayuhi.online",
              "img-src 'self' data: blob: https: https://image.tmdb.org https://images.unsplash.com https://*.tmdb.org https://vidzy.cc https://*.vidzy.cc https://luluvid.com https://*.luluvid.com https://*.gstatic.com https://s0.2mdn.net https://vercel.live https://vercel.com https://*.googlesyndication.com https://*.googleadservices.com https://*.doubleclick.net https://*.googleusercontent.com https://*.i.ibb.co https://upload.wikimedia.org https://i.imgur.com https://jiotvimages.cdn.jio.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://*.adtrafficquality.google",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "connect-src 'self' http://localhost:4000 https://chillers.onrender.com https://*.chillers.onrender.com https://www.chillers.site https://*.chillers.site https://vercel.live https://api.themoviedb.org https://image.tmdb.org https://*.tmdb.org https://*.uqload.is https://*.uqload.vc https://*.uqload.ws https://*.uqload.to https://*.uqload.co https://*.uqload.net https://*.uqload.com https://*.uqload.io https://doodstream.com https://*.doodstream.com https://d000d.com https://*.d000d.com https://d0000d.com https://*.d0000d.com https://vidzy.cc https://*.vidzy.cc http://vidzy.cc http://*.vidzy.cc https://luluvid.com https://*.luluvid.com https://pagead2.googlesyndication.com https://ep1.adtrafficquality.google https://*.adtrafficquality.google https://*.amagi.tv https://*.france24.com https://*.lcp.fr https://*.yacast.fr https://*.getaj.net https://*.wurl.com https://*.ott.tv5monde.com https://*.akamaized.net https://*.pluto.tv https://*.cloudfront.net https://*.nhkworld.jp http://amdlive-ch01.ctnd.com.edgesuite.net https://*.hayuhi.online https://*.sofast.tv https://*.stingray.com https://*.aynascope.net wss://tracker.webtorrent.dev wss://tracker.openwebtorrent.com https://tracker.openwebtorrent.com wss://tracker.btorrent.xyz wss://tracker.files.fm:7073 https://tracker.opentrackr.org:1337 wss://*.pusher.com https://*.pusher.com wss://*.pusherapp.com https://*.pusherapp.com",
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
