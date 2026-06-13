import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a minimal self-contained server (.next/standalone/server.js) for the
  // production Docker image — see Dockerfile's `runner` stage.
  output: "standalone",
  // Keep the Google Sheets client external (not webpack-bundled); it's still
  // traced into the standalone build and imported only server-side from lib/sheets.ts.
  serverExternalPackages: ["@googleapis/sheets"],
};

export default nextConfig;
