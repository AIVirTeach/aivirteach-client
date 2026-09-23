import { describe, expect, it } from "vitest";
import { safeErrorMessage, sanitizeErrorMessage } from "./safe-error-message";

describe("sanitizeErrorMessage", () => {
  it("短的纯文本原样返回", () => {
    expect(sanitizeErrorMessage("请先启动虚拟机后再提问。", "fallback")).toBe("请先启动虚拟机后再提问。");
  });

  it("空字符串或纯空白时返回 fallback", () => {
    expect(sanitizeErrorMessage("", "fallback")).toBe("fallback");
    expect(sanitizeErrorMessage("   \n", "fallback")).toBe("fallback");
  });

  it("看起来像 HTML 文档时返回 fallback，不把源码糊给用户", () => {
    const cloudflareErrorPage = '<!doctype html>\n<html class="no-js"><head><title>Error 1000</title></head></html>';
    expect(sanitizeErrorMessage(cloudflareErrorPage, "fallback")).toBe("fallback");
    expect(sanitizeErrorMessage("<html><body>Forbidden</body></html>", "fallback")).toBe("fallback");
  });

  it("框架自带的路由报错（Cannot POST /...）返回 fallback", () => {
    expect(sanitizeErrorMessage("Cannot POST /api/v1/workspaces/x/chat/messages/stream", "fallback")).toBe(
      "fallback",
    );
  });

  it("超过 200 字符时返回 fallback，不截断展示", () => {
    expect(sanitizeErrorMessage("x".repeat(201), "fallback")).toBe("fallback");
  });

  it("刚好 200 字符时原样返回", () => {
    const message = "x".repeat(200);
    expect(sanitizeErrorMessage(message, "fallback")).toBe(message);
  });
});

describe("safeErrorMessage", () => {
  it("caught 是 Error 时清洗它的 message", () => {
    expect(safeErrorMessage(new Error("请先启动虚拟机后再提问。"), "fallback")).toBe("请先启动虚拟机后再提问。");
  });

  it("caught 是 Error 但 message 像 HTML 时返回 fallback", () => {
    expect(safeErrorMessage(new Error("<!doctype html><html></html>"), "fallback")).toBe("fallback");
  });

  it("caught 不是 Error 时返回 fallback", () => {
    expect(safeErrorMessage("not an error", "fallback")).toBe("fallback");
    expect(safeErrorMessage(undefined, "fallback")).toBe("fallback");
  });
});
