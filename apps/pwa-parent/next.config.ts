import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    allowedHosts: [".monkeycode-ai.live"],
  },
};

export default nextConfig;
