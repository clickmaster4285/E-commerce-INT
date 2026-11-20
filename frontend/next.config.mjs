import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ==========================================
// I18N
// ------------------------------------------
// ⚠️ NO locale ROUTING is configured on purpose.
//    The app keeps its existing URLs and the language is carried in a plain
//    `lang` cookie (see src/i18n/config.js) that covers both the admin panel
//    and the storefront. Translations live in
//    src/i18n/locales/*.json (one file per language) and are consumed client-side through src/i18n/LanguageProvider.js — no next-intl
//    plugin, no route rewriting.

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Build speed: the project is 100% JavaScript (no .ts/.tsx files), but
   * `allowJs` in tsconfig made `next build` run a full TypeScript pass over
   * every .js file (~35s) that could not report real errors anyway
   * (`checkJs` is off). Skipping it changes nothing at runtime.
   * Use `npm run lint` to catch mistakes.
   */
  typescript: {
    ignoreBuildErrors: true,
  },

  allowedDevOrigins: [
    '192.168.88.35',
    '192.168.88.35',
    'localhost',
    '127.0.0.1',
    // Multi-tenant dev: nip.io root + har store subdomain + hosts-file custom domains (*.test)
    '192.168.88.35.nip.io',
    '*.192.168.88.35.nip.io',
    '*.test',
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
      {
        source: '/super-admin/settings',
        destination: '/super-admin/dashboard',
        permanent: false,
      },
      // /super-admin/activity ab real page hai ("My activity") — purana alias wahan bhejo
      {
        source: '/super-admin/activity-logs',
        destination: '/super-admin/activity',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

