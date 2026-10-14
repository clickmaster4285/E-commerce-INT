import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    '192.168.88.62',
    'localhost',
    '127.0.0.1',
  ],

  turbopack: {
    root: __dirname,
  },

  /**
   * Legacy category link fix.
   *
   * Purane banners me `primaryButton.link` `/category/<id>` format me save hua
   * tha, lekin app me `/category/[id]` route kabhi exist hi nahi hua — sirf
   * `/filtering-product?category=<id>` hai. Is liye storefront par banner ka
   * button 404 deta tha.
   *
   * Naye links ab theek bante hain (admin/banners/page.js), aur ye redirect
   * database me maujood purane banners ke links ko bhi wahi sahi page par
   * le jata hai. Redirects filesystem se PEHLE check hote hain, is liye
   * missing route par 404 se pehle hi user ko destination par bhej deta hai.
   */
  async redirects() {
    return [
      {
        source: '/category/:id',
        destination: '/filtering-product?category=:id',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;