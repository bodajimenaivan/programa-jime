import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@tus/server", "@tus/file-store"],
  experimental: {
    // Las acciones del servidor solo mueven texto; los archivos van por /api/uploads (tus).
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
