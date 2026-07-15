import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/doodstream/:path*',
        destination: 'https://chillers.onrender.com/api/doodstream/:path*',
      },
    ];
  },
};

export default nextConfig;
