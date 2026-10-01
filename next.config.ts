import type { NextConfig } from "next";
import { previewHeaders } from "./app/lib/lesson-blocks/preview-message";

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
