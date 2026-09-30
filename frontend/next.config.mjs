import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    '192.168.88.64',
    'localhost',
    '127.0.0.1',
  ],

  turbopack: {
    root: __dirname,
  },


};

export default nextConfig;