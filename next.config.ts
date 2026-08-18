import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le serveur standalone permet une image Docker runtime minimale.
  output: "standalone",
};

export default nextConfig;
