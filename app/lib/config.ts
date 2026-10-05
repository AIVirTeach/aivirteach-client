export type BackendMode = "local" | "remote";

const configuredMode = process.env.NEXT_PUBLIC_BACKEND_MODE;
const defaultMode: BackendMode = process.env.NODE_ENV === "production" ? "remote" : "local";

export const backendConfig = {
  mode: configuredMode === "remote" || configuredMode === "local" ? configuredMode : defaultMode,
  localUrl: (process.env.NEXT_PUBLIC_LOCAL_API_BASE_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, ""),
  remoteUrl: (process.env.NEXT_PUBLIC_REMOTE_API_BASE_URL ?? "https://aivirteach-server.vercel.app/api/v1").replace(/\/$/, ""),
} as const;

export const API_BASE_URL = backendConfig.mode === "remote" ? backendConfig.remoteUrl : backendConfig.localUrl;
