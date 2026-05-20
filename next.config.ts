import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark ssh2 as external to avoid bundling native modules
      config.externals = config.externals || []
      if (Array.isArray(config.externals)) {
        config.externals.push({
          ssh2: 'commonjs ssh2',
        })
      }
    }
    return config
  },
}

export default nextConfig
