import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    '192.168.88.73',
    'localhost',
    '127.0.0.1',
  ],

  turbopack: {
    root: __dirname,
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://192.168.88.73:5000/api/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://192.168.88.73:5000/uploads/:path*',
      },
    ];
  },
};

export default nextConfig;