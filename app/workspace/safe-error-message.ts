const MAX_MESSAGE_LENGTH = 200;

// 后端偶尔会把上游服务（Labs/Cloudflare tunnel 等）的原始报错，或框架自带的路由报错
// （比如 Nest 默认 404 的 "Cannot POST /..."）直接透出；这些都不该原样糊在学员看到的界面上。
export function sanitizeErrorMessage(message: string, fallback: string): string {
  const trimmed = message.trim();
  if (!trimmed) return fallback;
  if (/^<(!doctype|html)/i.test(trimmed)) return fallback;
  if (/^Cannot (GET|POST|PUT|PATCH|DELETE) /i.test(trimmed)) return fallback;
  if (trimmed.length > MAX_MESSAGE_LENGTH) return fallback;
  return trimmed;
}

export function safeErrorMessage(caught: unknown, fallback: string): string {
  if (!(caught instanceof Error)) return fallback;
  return sanitizeErrorMessage(caught.message, fallback);
}
