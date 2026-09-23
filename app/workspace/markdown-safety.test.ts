import { describe, expect, it } from "vitest";
import { isSafeMarkdownHref } from "./markdown-safety";

describe("isSafeMarkdownHref", () => {
  it("放行 http/https 链接", () => {
    expect(isSafeMarkdownHref("http://example.com")).toBe(true);
    expect(isSafeMarkdownHref("https://example.com/docs")).toBe(true);
  });

  it("放行 mailto、相对路径、锚点", () => {
    expect(isSafeMarkdownHref("mailto:test@example.com")).toBe(true);
    expect(isSafeMarkdownHref("/workspace")).toBe(true);
    expect(isSafeMarkdownHref("#section")).toBe(true);
  });

  it("拒绝 javascript: 等不可信 scheme", () => {
    expect(isSafeMarkdownHref("javascript:alert(1)")).toBe(false);
    expect(isSafeMarkdownHref("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("href 为 undefined 时拒绝", () => {
    expect(isSafeMarkdownHref(undefined)).toBe(false);
  });
});
