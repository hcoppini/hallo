import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/bar',
        destination: '/barman',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
