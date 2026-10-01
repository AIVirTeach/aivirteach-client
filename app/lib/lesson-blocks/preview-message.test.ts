import { describe, expect, it } from "vitest";
import { parsePreviewMessage, previewHeaders } from "./preview-message";

const origin = "https://admin.example.com";
const payload = {
  type: "lesson-preview",
  lessonTitle: "Lesson",
  moduleTitle: "Module",
  blocks: [{ id: "one", type: "paragraph", props: { text: "Hello" } }],
  assets: { image: { url: "https://cdn.example.com/image.png" } },
  problems: [{ blockId: "one", level: "warning", message: "Review" }],
};

describe("parsePreviewMessage", () => {
  it.each([
    "https://evil.example.com",
    "http://admin.example.com",
    "https://admin.example.com.evil.test",
    "null",
    "",
  ])("rejects origin %s", (eventOrigin) => {
    expect(parsePreviewMessage({ origin: eventOrigin, data: payload }, origin)).toBeNull();
  });

  it("rejects every message when the admin origin is not configured", () => {
    expect(parsePreviewMessage({ origin, data: payload }, undefined)).toBeNull();
  });

  it.each([null, undefined, "lesson-preview", 1, [], { type: "other" }])("rejects malformed data %j", (data) => {
    expect(parsePreviewMessage({ origin, data }, origin)).toBeNull();
  });

  it("normalizes missing or malformed fields while retaining malformed block entries", () => {
    expect(parsePreviewMessage({ origin, data: { type: "lesson-preview", blocks: [null, 1] } }, origin)).toEqual({
      lessonTitle: "",
      moduleTitle: "",
      blocks: [null, 1],
      assets: {},
      problems: [],
    });
  });

  it("accepts an exact origin and returns valid fields", () => {
    expect(parsePreviewMessage({ origin, data: payload }, origin)).toEqual({
      lessonTitle: "Lesson",
      moduleTitle: "Module",
      blocks: payload.blocks,
      assets: payload.assets,
      problems: payload.problems,
    });
  });
});

describe("previewHeaders", () => {
  it("allows only the configured admin origin and disables caching", () => {
    expect(previewHeaders(origin)).toEqual({
      "Content-Security-Policy": `frame-ancestors ${origin}`,
      "Cache-Control": "no-store",
    });
  });

  it("denies all framing when the admin origin is missing", () => {
    expect(previewHeaders()).toEqual({
      "Content-Security-Policy": "frame-ancestors 'none'",
      "Cache-Control": "no-store",
    });
  });
});
