import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// 独立配置，不继承 vite.config.ts——那边的 Cloudflare/RSC 插件跟 Vitest 的默认环境解析不兼容，
// 而这里只需要跑纯函数单测（app/lib 下的 *.test.ts），不需要那些插件。
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    include: ["app/**/*.test.ts", "app/**/*.test.tsx"],
  },
});
