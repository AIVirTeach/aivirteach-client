import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../globals.css", import.meta.url), "utf8");

function declarations(selector: string) {
  const line = css.split("\n").find((entry) => entry.startsWith(`${selector} {`));
  if (!line) throw new Error(`rule not found: ${selector}`);
  return line.slice(line.indexOf("{") + 1, line.lastIndexOf("}"));
}

// 纯 --amber (#fe932c) 在浅色背景上对比度约 2:1，文字必须和 --ink 混合后再用。
describe("warning text contrast", () => {
  it("mixes --ink into the standalone warning label colour", () => {
    expect(declarations(".lesson-blocks .lb-warning")).toMatch(/color: color-mix\(in srgb, var\(--amber\) \d+%, var\(--ink\)\)/);
  });

  it("gives the warning callout title its own readable colour", () => {
    expect(declarations(".lesson-blocks .lesson-callout--warning")).toMatch(/--lesson-callout-text: color-mix\(in srgb, var\(--amber\) \d+%, var\(--ink\)\)/);
    expect(declarations(".lesson-blocks .lesson-callout h4")).toContain("color: var(--lesson-callout-text, var(--lesson-callout-color))");
  });
});
