import type { NextConfig } from 'next'

const nextConfigPages: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

export default nextConfigPages