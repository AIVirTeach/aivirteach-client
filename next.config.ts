import type { NextConfig } from "next";
import { adminOriginProblem, previewHeaders } from "./app/lib/lesson-blocks/preview-message";

const adminOriginWarning = adminOriginProblem(process.env.NEXT_PUBLIC_ADMIN_ORIGIN);
if (adminOriginWarning) console.warn(`[preview] ${adminOriginWarning}`);

const nextConfig: NextConfig = {
  async headers() {
    const headers = previewHeaders(process.env.NEXT_PUBLIC_ADMIN_ORIGIN);
    return [{
      source: "/preview/lesson",
      headers: Object.entries(headers).map(([key, value]) => ({ key, value })),
    }];
  },
};

export default nextConfig;
