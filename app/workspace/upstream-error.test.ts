import { describe, expect, it } from "vitest";
import { ApiError } from "../lib/api";
import { upstreamErrorMessage, type UpstreamErrorMessages } from "./upstream-error";

const MESSAGES: UpstreamErrorMessages = {
  retryable: "连接不上，请稍后重试。",
  unavailable: "暂时无法使用，请联系客服。",
};

describe("upstreamErrorMessage", () => {
  it.each([408, 429, 500, 502, 503, 504])("ApiError status %i 归类为 retryable", (status) => {
    expect(upstreamErrorMessage(new ApiError(status, "raw upstream detail"), MESSAGES)).toBe(MESSAGES.retryable);
  });

  it.each([400, 401, 403, 404, 422])("ApiError status %i 归类为 unavailable", (status) => {
    expect(upstreamErrorMessage(new ApiError(status, "raw upstream detail"), MESSAGES)).toBe(MESSAGES.unavailable);
  });

  it("永远不会把 ApiError.message 的原始内容透出去（不管内容看起来多安全）", () => {
    const caught = new ApiError(404, "Cannot POST /api/v1/workspaces/x/chat/messages/stream");
    expect(upstreamErrorMessage(caught, MESSAGES)).toBe(MESSAGES.unavailable);
  });

  it("非 ApiError（比如网络层直接 reject）视为瞬时性问题，走 retryable", () => {
    expect(upstreamErrorMessage(new TypeError("Failed to fetch"), MESSAGES)).toBe(MESSAGES.retryable);
    expect(upstreamErrorMessage("not an error", MESSAGES)).toBe(MESSAGES.retryable);
    expect(upstreamErrorMessage(undefined, MESSAGES)).toBe(MESSAGES.retryable);
  });
});
