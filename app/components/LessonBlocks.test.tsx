import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlockErrorBoundary } from "./BlockErrorBoundary";
import { CourseLessonContent } from "./CourseLessonContent";
import { LessonBlocks } from "./LessonBlocks";
import type { RawLessonBlock } from "../lib/lesson-blocks/types";
import canonicalFixture from "../lib/lesson-blocks/__fixtures__/canonical-lesson.json";

const canonical = canonicalFixture.valid;
const canonicalBlocks = canonical.blocks as RawLessonBlock[];

describe("LessonBlocks", () => {
  it("dispatches all canonical block types", () => {
    const html = renderToStaticMarkup(<LessonBlocks blocks={canonicalBlocks} assets={canonicalFixture.assets} mode="learner" />);
    expect(html).toContain('class="lesson-blocks lesson-markdown"');
    for (const marker of ["deploy-heading", "deploy-intro", "deploy-prerequisites", "deploy-sequence", 'data-kind="terminal"', 'data-kind="file"', 'data-kind="plain"', "deploy-step-one", "deploy-tip", "deploy-warning", "deploy-note", "deploy-settings-table", "deploy-terminal-image", "deploy-runbook-link", "deploy-divider", "deploy-annotated-config", "deploy-flow"]) {
      expect(html).toContain(marker);
    }
    expect(new Set(canonicalBlocks.map((block) => block.type)).size).toBe(13);
  });

  it("skips unknown blocks and null props in learner mode while rendering valid siblings", () => {
    const html = renderToStaticMarkup(<LessonBlocks blocks={[
      { id: "before", type: "paragraph", props: { text: "before" } },
      { id: "unknown", type: "future", props: {} },
      { id: "bad", type: "heading", props: null },
      { id: "after", type: "paragraph", props: { text: "after" } },
    ]} assets={{}} mode="learner" />);
    expect(html).toContain("before");
    expect(html).toContain("after");
    expect(html).not.toContain("future");
    expect(html).not.toContain("无法渲染");
  });

  it("contains malformed nested props in learner mode instead of breaking sibling rendering", () => {
    const html = renderToStaticMarkup(<LessonBlocks blocks={[
      { id: "bad", type: "callout", props: { variant: "tip", title: 9, body: "bad" } },
      { id: "after", type: "paragraph", props: { text: "after" } },
    ]} assets={{}} mode="learner" />);
    expect(html).toContain("after");
    expect(html).not.toContain("lb-invalid");
  });

  it("skips malformed annotated code terms before SSR can throw", () => {
    const html = renderToStaticMarkup(<LessonBlocks blocks={[
      { id: "bad", type: "annotatedCode", props: { steps: [{ label: "Bad term", code: "run", terms: [null] }] } },
      { id: "after", type: "paragraph", props: { text: "after" } },
    ]} assets={{}} mode="learner" />);
    expect(html).toContain("after");
    expect(html).not.toContain("Bad term");
  });

  it("shows preview placeholders with matching problem messages for invalid blocks", () => {
    const html = renderToStaticMarkup(<LessonBlocks blocks={[{ id: "bad", type: "heading", props: null }]} assets={{}} mode="preview" problems={[{ blockId: "bad", level: "error", message: "标题字段无效" }]} />);
    expect(html).toContain("lb-invalid");
    expect(html).toContain("标题字段无效");
  });

  it("renders preview warnings beside their block", () => {
    const html = renderToStaticMarkup(<LessonBlocks blocks={[canonicalBlocks[1]!]} assets={{}} mode="preview" problems={[{ blockId: "deploy-intro", level: "warning", message: "内容较短" }]} />);
    expect(html).toContain("内容较短");
    expect(html).toContain("lb-warning");
  });

  it("keeps preview warnings visible beside an invalid block placeholder", () => {
    const html = renderToStaticMarkup(<LessonBlocks blocks={[{ id: "bad", type: "future", props: {} }]} assets={{}} mode="preview" problems={[{ blockId: "bad", level: "warning", message: "即将弃用" }]} />);
    expect(html).toContain("lb-invalid");
    expect(html).toContain("即将弃用");
  });

  it("renders an empty blocks array without falling back to markdown", () => {
    expect(renderToStaticMarkup(<CourseLessonContent markdown="# Original" blocks={[]} assets={{}} />)).toBe('<div class="lesson-blocks lesson-markdown"></div>');
  });

  it("preserves the existing markdown HTML when blocks are absent or null", () => {
    const beforeChange = '<div class="lesson-markdown"><h2>Title</h2><p>Text with <strong>bold</strong>.</p><ul><li>one</li><li>two</li></ul></div>';
    expect(renderToStaticMarkup(<CourseLessonContent markdown={'## Title\n\nText with **bold**.\n\n- one\n- two'} />)).toBe(beforeChange);
    expect(renderToStaticMarkup(<CourseLessonContent markdown={'## Title\n\nText with **bold**.\n\n- one\n- two'} blocks={null} />)).toBe(beforeChange);
  });

  it("marks a renderer error as failed in the error boundary", () => {
    expect(BlockErrorBoundary.getDerivedStateFromError(new Error("broken"))).toEqual({ failed: true });
  });
});
