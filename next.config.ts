import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the Playwright suite build into its own folder without clobbering a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
