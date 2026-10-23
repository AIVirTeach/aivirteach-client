import { describe, expect, it } from "vitest";
import { parseBrowserNumber } from "./use-browser-number";

describe("stored browser number", () => {
  it("uses its default for missing or invalid values and clamps valid persisted widths", () => {
    expect(parseBrowserNumber(null, 420, { min: 320, max: 720 })).toBe(420);
    expect(parseBrowserNumber("not-a-number", 420, { min: 320, max: 720 })).toBe(420);
    expect(parseBrowserNumber("-10", 420, { min: 320, max: 720 })).toBe(420);
    expect(parseBrowserNumber("9999", 420, { min: 320, max: 720 })).toBe(720);
    expect(parseBrowserNumber("390", 420, { min: 320, max: 720 })).toBe(390);
  });
});
