import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",

  // Disable image optimization in standalone mode (optional)
  images: {
    unoptimized: true,
  },

  // Environment variables that should be available at build time
  env: {
    NEXT_PUBLIC_APP_URL: process.env.AUTH_URL || "http://localhost:3000",
  },
};

export default nextConfig;
