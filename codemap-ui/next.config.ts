import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Using an explicit named hostname block to bypass local numeric string truncation errors
  async rewrites() {
    return [
      {
        source: "/api/analyze-structure",
        destination: "http://localhost:8000/api/analyze-structure",
      },
    ];
  },
};

export default nextConfig;
