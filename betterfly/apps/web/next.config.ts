import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@betterfly/shared"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
