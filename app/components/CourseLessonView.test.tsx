import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseLessonView } from "./CourseLessonView";
import { copyLessonCode, writeBrowserClipboard } from "./lesson-blocks/copy-code";
import { parsePreviewMessage } from "../lib/lesson-blocks/preview-message";
import fixture from "../lib/lesson-blocks/__fixtures__/canonical-lesson.json";
import type { RawLessonBlock } from "../lib/lesson-blocks/types";

const lesson = { title: "同一份课时", moduleTitle: "模块", blocks: fixture.valid.blocks as RawLessonBlock[] };
describe("shared Lab and preview view", () => {
  it("renders identical markup from published content and the admin message for all block types", () => {
    const parsed = parsePreviewMessage({ origin: "https://admin.example.com", data: { type: "lesson-preview", lesson, assets: fixture.assets } }, "https://admin.example.com")!;
    const preview = renderToStaticMarkup(<CourseLessonView mode="preview" {...parsed.lesson} assets={parsed.assets} problems={parsed.problems} />);
    const published = renderToStaticMarkup(<CourseLessonView mode="learner" {...lesson} assets={fixture.assets} />);
    expect(preview).toBe(published);
    expect(new Set(lesson.blocks.map((block) => block.type)).size).toBe(13);
  });
  it("uses Markdown only when blocks are absent, not when the array is empty", () => {
    expect(renderToStaticMarkup(<CourseLessonView mode="learner" title="x" moduleTitle="m" markdown="old content" />)).toContain("old content");
    expect(renderToStaticMarkup(<CourseLessonView mode="learner" title="x" moduleTitle="m" blocks={[]} markdown="old content" />)).not.toContain("old content");
  });
  it("escapes titles and diagnoses invalid draft blocks without breaking the view", () => {
    const html = renderToStaticMarkup(<CourseLessonView mode="preview" title="<script>alert(1)</script>" moduleTitle="m" blocks={[{ id: "bad", type: "unknown", props: {} }]} />);
    expect(html).not.toContain("<script>");
    expect(html).toContain("lb-invalid");
  });
  it("copies to the VM even if the browser clipboard is denied", async () => {
    const vm = vi.fn(() => true);
    expect(await copyLessonCode("code", async () => { throw new Error("Denied"); }, vm)).toEqual({ clipboardCopied: false, vmCopied: true });
    expect(vm).toHaveBeenCalledWith("code");
  });
  it("reports a disconnected VM independently and preview needs no VM callback", async () => {
    const write = vi.fn(async () => {});
    expect(await copyLessonCode("code", write, () => false)).toEqual({ clipboardCopied: true, vmCopied: false });
    expect(await copyLessonCode("draft", write)).toEqual({ clipboardCopied: true, vmCopied: false });
    expect(write).toHaveBeenLastCalledWith("draft");
  });
});

describe("legacy browser clipboard fallback", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("retains local copying without the Clipboard API and removes its temporary input", async () => {
    const input = { value: "", style: {}, select: vi.fn(), remove: vi.fn() };
    const execCommand = vi.fn(() => true);
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("document", { createElement: () => input, body: { appendChild: vi.fn() }, execCommand });
    await writeBrowserClipboard("legacy code");
    expect(input.value).toBe("legacy code");
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(input.remove).toHaveBeenCalledOnce();
  });
});
