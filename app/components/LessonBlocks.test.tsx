import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlockErrorBoundary } from "./BlockErrorBoundary";
import { CourseLessonContent } from "./CourseLessonContent";
import { LessonBlocks } from "./LessonBlocks";
import type { RawLessonBlock } from "../lib/lesson-blocks/types";

const blocks: RawLessonBlock[] = [
  { id: "h", type: "heading", props: { level: 2, text: "Heading" } },
  { id: "p", type: "paragraph", props: { text: "Paragraph" } },
  { id: "ul", type: "bulletList", props: { items: ["Bullet"] } },
  { id: "ol", type: "numberedList", props: { items: ["Numbered"] } },
  { id: "code", type: "code", props: { kind: "plain", code: "const x = 1" } },
  { id: "step", type: "step", props: { number: 1, title: "Step" } },
  { id: "callout", type: "callout", props: { variant: "tip", body: "Tip" } },
  { id: "table", type: "table", props: { columns: ["A"], rows: [["B"]] } },
  { id: "image", type: "image", props: { assetId: "asset", alt: "Picture" } },
  { id: "link", type: "resourceLink", props: { url: "https://example.com", title: "Link" } },
  { id: "divider", type: "divider", props: {} },
  { id: "annotated", type: "annotatedCode", props: { steps: [{ label: "Run", code: "go", terms: [] }] } },
  { id: "diagram", type: "diagram", props: { nodes: [{ id: "n", title: "Node" }], connections: [] } },
];

describe("LessonBlocks", () => {
  it("dispatches all canonical block types", () => {
    const html = renderToStaticMarkup(<LessonBlocks blocks={blocks} assets={{ asset: { url: "/picture.png" } }} mode="learner" />);
    expect(html).toContain('class="lesson-blocks"');
    for (const marker of ["Heading", "Paragraph", "Bullet", "Numbered", "const x = 1", "Step", "Tip", "课程表格", "Picture", "Link", "divider", "STEP 1", "Node"]) {
      expect(html).toContain(marker);
    }
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

  it("shows preview placeholders with matching problem messages for invalid blocks", () => {
    const html = renderToStaticMarkup(<LessonBlocks blocks={[{ id: "bad", type: "heading", props: null }]} assets={{}} mode="preview" problems={[{ blockId: "bad", level: "error", message: "标题字段无效" }]} />);
    expect(html).toContain("lb-invalid");
    expect(html).toContain("标题字段无效");
  });

  it("renders preview warnings beside their block", () => {
    const html = renderToStaticMarkup(<LessonBlocks blocks={[blocks[1]]} assets={{}} mode="preview" problems={[{ blockId: "p", level: "warning", message: "内容较短" }]} />);
    expect(html).toContain("内容较短");
    expect(html).toContain("lb-warning");
  });

  it("keeps preview warnings visible beside an invalid block placeholder", () => {
    const html = renderToStaticMarkup(<LessonBlocks blocks={[{ id: "bad", type: "future", props: {} }]} assets={{}} mode="preview" problems={[{ blockId: "bad", level: "warning", message: "即将弃用" }]} />);
    expect(html).toContain("lb-invalid");
    expect(html).toContain("即将弃用");
  });

  it("renders an empty blocks array without falling back to markdown", () => {
    expect(renderToStaticMarkup(<CourseLessonContent markdown="# Original" blocks={[]} assets={{}} />)).toBe('<div class="lesson-blocks"></div>');
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
