import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is required for the multi-stage Docker runner image.
  // It bundles only the files needed to run the server (no node_modules copy).
  output: "standalone",

  // Proxy /api/* calls to the backend.
  // NEXT_PUBLIC_BACKEND_URL is injected at build time by Dockerfile.frontend.
  // Falls back to localhost:8000 for local (non-Docker) development.
  async rewrites() {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api/analyze-structure",
        destination: `${backendUrl}/api/analyze-structure`,
      },
    ];
  },
};

export default nextConfig;
