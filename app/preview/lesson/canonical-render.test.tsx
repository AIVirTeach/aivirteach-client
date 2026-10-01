import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LessonBlocks } from "../../components/LessonBlocks";
import { parsePreviewMessage } from "../../lib/lesson-blocks/preview-message";
import type { RawLessonBlock } from "../../lib/lesson-blocks/types";
import fixture from "../../lib/lesson-blocks/__fixtures__/canonical-lesson.json";

describe("preview renderer canonical fixture", () => {
  it("renders all 13 canonical block types in preview mode", () => {
    const html = renderToStaticMarkup(<LessonBlocks blocks={fixture.valid.blocks as RawLessonBlock[]} assets={fixture.assets} mode="preview" />);
    for (const marker of ["deploy-heading", "deploy-intro", "deploy-prerequisites", "deploy-sequence", 'data-kind="terminal"', 'data-kind="file"', 'data-kind="plain"', "deploy-step-one", "deploy-tip", "deploy-warning", "deploy-note", "deploy-settings-table", "deploy-terminal-image", "deploy-runbook-link", "deploy-divider", "deploy-annotated-config", "deploy-flow"]) {
      expect(html).toContain(marker);
    }
    expect(new Set(fixture.valid.blocks.map((block) => block.type)).size).toBe(13);
  });

  it("shows a preview placeholder for an unknown fixture block", () => {
    const unknown = fixture.invalid.find((item) => item.name === "unknown block type")!;
    const envelope = unknown.content as { blocks: RawLessonBlock[] };
    expect(renderToStaticMarkup(<LessonBlocks blocks={envelope.blocks} assets={fixture.assets} mode="preview" />)).toContain("lb-invalid");
  });

  it("does not throw while previewing invalid fixture blocks", () => {
    const invalidFixtures = fixture.invalid.filter((item) => Array.isArray((item.content as { blocks?: unknown })?.blocks));
    for (const invalid of invalidFixtures) {
      const envelope = invalid.content as { blocks: RawLessonBlock[] };
      expect(() => renderToStaticMarkup(<LessonBlocks blocks={envelope.blocks} assets={fixture.assets} mode="preview" />), invalid.name).not.toThrow();
    }
  });

  it("retains malformed array entries for preview placeholders without crashing either mode", () => {
    const blocks = [null, 1, { id: "ok", type: "paragraph", props: { text: "Still visible" } }] as unknown as RawLessonBlock[];
    const previewHtml = renderToStaticMarkup(<LessonBlocks blocks={blocks} assets={{}} mode="preview" />);
    expect(previewHtml.match(/lb-invalid/g)).toHaveLength(2);
    expect(previewHtml).toContain("Still visible");
    expect(() => renderToStaticMarkup(<LessonBlocks blocks={blocks} assets={{}} mode="learner" />)).not.toThrow();
  });

  it("does not throw on invalid fixture blocks in learner mode", () => {
    const invalidFixtures = fixture.invalid.filter((item) => Array.isArray((item.content as { blocks?: unknown })?.blocks));
    for (const invalid of invalidFixtures) {
      const envelope = invalid.content as { blocks: RawLessonBlock[] };
      expect(() => renderToStaticMarkup(<LessonBlocks blocks={envelope.blocks} assets={fixture.assets} mode="learner" />), invalid.name).not.toThrow();
    }
  });

  it("normalizes and safely renders the non-object content invalid fixture", () => {
    const invalid = fixture.invalid.find((item) => item.name === "content is not an object")!;
    const parsed = parsePreviewMessage({
      origin: "https://admin.example.com",
      data: { type: "lesson-preview", lesson: invalid.content },
    }, "https://admin.example.com");
    expect(parsed?.lesson.blocks).toEqual([]);
    expect(() => renderToStaticMarkup(<LessonBlocks blocks={parsed!.lesson.blocks} assets={parsed!.assets} mode="preview" />)).not.toThrow();
    expect(() => renderToStaticMarkup(<LessonBlocks blocks={parsed!.lesson.blocks} assets={parsed!.assets} mode="learner" />)).not.toThrow();
  });

  it("renders safely when same-origin messages contain malformed problem entries", () => {
    const parsed = parsePreviewMessage({
      origin: "https://admin.example.com",
      data: {
        type: "lesson-preview",
        lesson: { title: "Lesson", moduleTitle: "Module", blocks: [{ id: "one", type: "paragraph", props: { text: "Hello" } }] },
        assets: {},
        problems: [null, { blockId: 9, level: "error", message: "bad id" }, { blockId: "one", level: "warning", message: "valid warning" }],
      },
    }, "https://admin.example.com");
    expect(() => renderToStaticMarkup(<LessonBlocks blocks={parsed!.lesson.blocks} assets={parsed!.assets} problems={parsed!.problems} mode="preview" />)).not.toThrow();
    expect(renderToStaticMarkup(<LessonBlocks blocks={parsed!.lesson.blocks} assets={parsed!.assets} problems={parsed!.problems} mode="preview" />)).toContain("valid warning");
  });
});
