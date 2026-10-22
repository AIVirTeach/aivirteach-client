import { spawnSync } from "node:child_process";

// Public production addresses must be present during compilation: setting Worker
// variables after the build cannot update NEXT_PUBLIC values in browser bundles.
const result = spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    CLOUDFLARE_PRODUCTION: "1",
    NEXT_PUBLIC_BACKEND_MODE: "remote",
    NEXT_PUBLIC_REMOTE_API_BASE_URL: "https://aivirteach-server.vercel.app/api/v1",
    NEXT_PUBLIC_ADMIN_ORIGIN: "https://aivirteach-admin.vercel.app",
  },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
