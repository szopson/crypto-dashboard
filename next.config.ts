import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['ccxt'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'coin-images.coingecko.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
