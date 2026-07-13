import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: "50mb",
  },
  serverExternalPackages: ["mammoth", "pdf-parse"],
  turbopack: {
    ignoreIssue: [
      {
        path: "**/next.config.ts",
        title: "Encountered unexpected file in NFT list",
      },
    ],
  },
};

export default nextConfig;
