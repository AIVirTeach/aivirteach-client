import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// 独立配置，不继承 vite.config.ts——那边的 Cloudflare/RSC 插件跟 Vitest 的默认环境解析不兼容，
// 测试应用逻辑和本地开发插件，不加载 Cloudflare/RSC 插件。
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    include: ["app/**/*.test.ts", "app/**/*.test.tsx", "build/**/*.test.ts"],
  },
});
