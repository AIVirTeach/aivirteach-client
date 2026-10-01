import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { handleImageLightboxKeyDown } from "./ImageLightbox";
import {
  AnnotatedCodeBlock,
  DiagramBlock,
  ImageBlock,
  ResourceLinkBlock,
  TableBlock,
} from "./ComplexBlocks";

describe("complex lesson blocks", () => {
  it("contains forward and reverse Tab navigation inside the image lightbox", () => {
    const first = { focus: () => undefined };
    const last = { focus: () => undefined };
    const firstFocus = vi.spyOn(first, "focus");
    const lastFocus = vi.spyOn(last, "focus");
    const dialog = { querySelectorAll: () => [first, last], focus: vi.fn() };
    const onClose = vi.fn();
    const forward = { key: "Tab", shiftKey: false, preventDefault: vi.fn() };
    handleImageLightboxKeyDown(forward, dialog, last, onClose);
    expect(forward.preventDefault).toHaveBeenCalledOnce();
    expect(firstFocus).toHaveBeenCalledOnce();

    const reverse = { key: "Tab", shiftKey: true, preventDefault: vi.fn() };
    handleImageLightboxKeyDown(reverse, dialog, first, onClose);
    expect(reverse.preventDefault).toHaveBeenCalledOnce();
    expect(lastFocus).toHaveBeenCalledOnce();
  });

  it("closes the image lightbox on Escape", () => {
    const onClose = vi.fn();
    handleImageLightboxKeyDown({ key: "Escape", shiftKey: false, preventDefault: vi.fn() }, { querySelectorAll: () => [], focus: vi.fn() }, null, onClose);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders table headings, rows, and inline formatting", () => {
    const html = renderToStaticMarkup(<TableBlock id="table" props={{ columns: ["Name", "Detail"], rows: [["Ada", "**bold**"]] }} />);
    expect(html).toContain('<th scope="col">Name</th><th scope="col">Detail</th>');
    expect(html).toContain("<td>Ada</td><td><strong>bold</strong></td>");
  });

  it("renders an image with alt text and caption from the asset map", () => {
    const html = renderToStaticMarkup(<ImageBlock id="image" props={{ assetId: "a1", alt: "Diagram", caption: "Example" }} assets={{ a1: { url: "/diagram.png" } }} />);
    expect(html).toContain('<img alt="Diagram"');
    expect(html).toContain('src="/diagram.png"');
    expect(html).toContain("<figcaption>Example</figcaption>");
  });

  it("uses a missing-image placeholder without rendering an image", () => {
    const html = renderToStaticMarkup(<ImageBlock id="missing" props={{ assetId: "absent", alt: "Diagram" }} assets={{}} />);
    expect(html).toContain("图片缺失");
    expect(html).not.toContain("<img");
  });

  it("renders safe resource links as external cards and unsafe links as plain cards", () => {
    const safe = renderToStaticMarkup(<ResourceLinkBlock id="safe" props={{ url: "https://example.com/", title: "Docs", description: "Read more" }} />);
    expect(safe).toContain('class="lesson-activity lb-resource-link"');
    expect(safe).toContain('target="_blank" rel="noopener noreferrer"');
    const unsafe = renderToStaticMarkup(<ResourceLinkBlock id="unsafe" props={{ url: "javascript:alert(1)", title: "Bad" }} />);
    expect(unsafe).not.toContain("<a");
    expect(unsafe).toContain("Bad");
  });

  it("renders each annotated code step with a copy control and inline terms", () => {
    const html = renderToStaticMarkup(<AnnotatedCodeBlock id="annotated" props={{ title: "Walkthrough", steps: [
      { label: "first", code: "const x = 1", explanation: "Use **this**.", terms: [{ term: "const", description: "A *binding*." }] },
      { label: "second", code: "run()", terms: [] },
    ] }} />);
    expect(html).toContain("STEP 1");
    expect(html).toContain("STEP 2");
    expect(html).toContain("STEP 1 · first");
    expect(html).toContain("STEP 2 · second");
    expect((html.match(/Copy code to clipboard/g) ?? []).length).toBe(2);
    expect(html).toContain("<strong>this</strong>");
    expect(html).toContain("<em>binding</em>");
  });

  it("renders diagram nodes and connection labels in declared order, skipping dangling edges", () => {
    const html = renderToStaticMarkup(<DiagramBlock id="diagram" props={{ nodes: [
      { id: "a", title: "Start" }, { id: "b", title: "Middle" }, { id: "c", title: "End" },
    ], connections: [
      { from: "a", to: "b", label: "first" }, { from: "missing", to: "c", label: "skip" }, { from: "b", to: "c", label: "second" },
    ] }} />);
    expect(html.indexOf("Start")).toBeLessThan(html.indexOf("first"));
    expect(html.indexOf("first")).toBeLessThan(html.indexOf("<h4>Middle"));
    expect(html.indexOf("<h4>Middle")).toBeLessThan(html.indexOf("second"));
    expect(html.indexOf("second")).toBeLessThan(html.indexOf("<h4>End"));
    expect(html).not.toContain("skip");
  });
});
