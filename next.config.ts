import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/demo",
        destination: "https://meet.brevo.com/cycleofbusiness",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Once a browser has reached the site over HTTPS, never allow it to
          // fall back to HTTP for this domain.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000",
          },
          // Prevent a page from loading an HTTP asset if one is ever added.
          {
            key: "Content-Security-Policy",
            value: "upgrade-insecure-requests; block-all-mixed-content",
          },
        ],
      },
    ];
  },
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
