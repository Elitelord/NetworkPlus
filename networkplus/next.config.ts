import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.trim();
    if (!allowedOrigins) return [];
    const origins = allowedOrigins.split(",").map((o) => o.trim()).filter(Boolean);
    if (origins.length === 0) return [];
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: origins[0] },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;
