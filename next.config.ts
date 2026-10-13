import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Allow the dev server to be reached over Tailscale (IPs and MagicDNS names).
  allowedDevOrigins: ["*.ts.net", "100.*.*.*", "*.local"],
};

export default nextConfig;
