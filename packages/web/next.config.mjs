/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@agro/shared'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
