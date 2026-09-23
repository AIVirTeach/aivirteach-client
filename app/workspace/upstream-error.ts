import { ApiError } from "../lib/api";

export type UpstreamErrorTier = "retryable" | "unavailable";
export type UpstreamErrorMessages = Record<UpstreamErrorTier, string>;

// 408/429/5xx 是瞬时性问题，提示重试有意义；其余（401/403/404 等）通常是权限或配置问题，
// 重试大概率没用，应该提示联系客服而不是让用户反复重试。跟 aivirteach-server 的
// classifyUpstreamStatus 保持同一套分档逻辑。
function classifyApiStatus(status: number): UpstreamErrorTier {
  if (status === 408 || status === 429 || status >= 500) return "retryable";
  return "unavailable";
}

// 不管 ApiError.message 内容看起来多"安全"，都不展示——只按状态码分档取事先写好的文案。
// 非 ApiError（fetch 本身 reject：断网、超时……）拿不到状态码，本质也是瞬时性问题，按 retryable 处理。
export function upstreamErrorMessage(caught: unknown, messages: UpstreamErrorMessages): string {
  if (caught instanceof ApiError) return messages[classifyApiStatus(caught.status)];
  return messages.retryable;
}
