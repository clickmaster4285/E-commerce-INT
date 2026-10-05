import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    '192.168.88.39',
    '192.168.88.73',
    'localhost',
    '127.0.0.1',
  ],

  turbopack: {
    root: __dirname,
  },

  // ✅ Perf (behavior same — sirf delivery optimize):
  compress: true,
  compiler: {
    // sirf production me console.* hatata hai, console.error rakhta hai
    removeConsole: { exclude: ['error'] },
  },
  experimental: {
    // barrel imports tree-shake (lucide/react-icons/select/recharts)
    optimizePackageImports: ['lucide-react', 'react-icons', 'react-select', 'recharts', '@react-oauth/google'],
  },
  images: {
    // WebP/AVIF first, plain <img> wali JPEGs ko optimized serve
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
    // ✅ LAN/dev only: backend private IP (192.168.x) ko optimizer allow.
    // Env flag se (NEXT_IMAGE_ALLOW_LOCAL_IP=1). PRODUCTION (public
    // domain) me OFF rakho — public IPs waise hi allowed hain.
    dangerouslyAllowLocalIP: process.env.NEXT_IMAGE_ALLOW_LOCAL_IP === '1',
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
      { protocol: 'http', hostname: '192.168.88.73' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },

};

export default nextConfig;
