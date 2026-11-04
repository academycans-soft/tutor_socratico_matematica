/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*',
      },
      {
        source: '/health',
        destination: 'http://localhost:8080/health',
      },
    ];
  },
};

export default nextConfig;
