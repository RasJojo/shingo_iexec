/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['picsum.photos', 'assets.coingecko.com'],
  },
  transpilePackages: [
    '@mysten/dapp-kit',
    '@mysten/sui',
    '@mysten/sui.js',
    '@tanstack/react-query',
    '@vanilla-extract/css',
  ],
  webpack: (config) => {
    config.resolve.alias['lru-cache'] = path.resolve(__dirname, 'lru-cache-shim.cjs');
    return config;
  },
};

export default nextConfig;
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
