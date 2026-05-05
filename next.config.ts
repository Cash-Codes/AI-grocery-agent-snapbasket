import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone bundles all server deps so the runtime container needs no node_modules.
  // Required for the Dockerfile's slim runtime stage.
  output: "standalone",
};

export default nextConfig;
