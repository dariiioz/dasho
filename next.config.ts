import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le serveur standalone permet une image Docker runtime minimale.
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
