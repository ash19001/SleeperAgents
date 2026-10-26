import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A second server (e.g. replay mode beside a live one) needs its own build folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
