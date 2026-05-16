/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',       // Static export — required for Capacitor
  trailingSlash: true,    // iOS file routing compatibility
  images: {
    unoptimized: true,    // Required for static export
  },
};

export default nextConfig;
