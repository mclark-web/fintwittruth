import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  outputFileTracingIncludes: {
    "/*": ["./prisma/fintwittruth.db"],
    "/**/*": ["./prisma/fintwittruth.db"],
  },
};

export default nextConfig;
