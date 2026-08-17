/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.88.69'],
  async rewrites() {
    return [
      {
        // Jab bhi frontend se /api/... ki call aaye
        source: '/api/:path*',
        // Usay chupke se Express backend (port 5000) par bhej do
        destination: 'http://192.168.88.64:5000/api/:path*',
      },
      {
        // Agar aap store ka logo ya koi image dikhate hain jo /uploads mein save hoti hai
        source: '/uploads/:path*',
        destination: 'http://192.168.88.64:5000/uploads/:path*',
      },
    ];
  },
};

export default nextConfig;