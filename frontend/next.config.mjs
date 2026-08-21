/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    '192.168.88.64',
    'localhost',
    '127.0.0.1',
  ],

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://192.168.88.64:5000/api/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://192.168.88.64:5000/uploads/:path*',
      },
    ];
  },
};

export default nextConfig;