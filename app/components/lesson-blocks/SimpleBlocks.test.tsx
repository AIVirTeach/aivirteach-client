import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CalloutBlock,
  CodeBlock,
  CopyButton,
  DividerBlock,
  HeadingBlock,
  ListBlock,
  ParagraphBlock,
  StepBlock,
} from "./SimpleBlocks";

describe("simple lesson blocks", () => {
  it("renders heading levels with stable ids and omits empty headings", () => {
    expect(renderToStaticMarkup(<><HeadingBlock id="h2" props={{ level: 2, text: "Title" }} /><HeadingBlock id="h3" props={{ level: 3, text: "Sub" }} /><HeadingBlock id="empty" props={{ level: 2, text: " " }} /></>))
      .toBe('<div class="lesson-markdown"><h2 id="h2">Title</h2></div><div class="lesson-markdown"><h3 id="h3">Sub</h3></div>');
  });

  it("renders paragraph inline formatting in lesson markdown", () => {
    expect(renderToStaticMarkup(<ParagraphBlock id="p" props={{ text: "Use **bold** and [safe](https://example.com)." }} />))
      .toBe('<p id="p" class="lesson-markdown">Use <strong>bold</strong> and <a href="https://example.com" target="_blank" rel="noopener noreferrer">safe</a>.</p>');
  });

  it("filters empty list items and uses the requested list kind", () => {
    expect(renderToStaticMarkup(<><ListBlock id="ul" ordered={false} props={{ items: ["first", "", "second"] }} /><ListBlock id="ol" ordered props={{ items: ["one"] }} /></>))
      .toBe('<ul id="ul" class="lesson-markdown"><li>first</li><li>second</li></ul><ol id="ol" class="lesson-markdown"><li>one</li></ol>');
    expect(renderToStaticMarkup(<ListBlock id="empty" ordered={false} props={{ items: ["", "   "] }} />)).toBe("");
  });

  it("renders escaped code in terminal, file, and plain blocks with an accessible copy control", () => {
    for (const kind of ["terminal", "file", "plain"] as const) {
      const html = renderToStaticMarkup(<CodeBlock id="code" props={{ kind, code: "<script>alert(1)</script>", label: "app.ts", language: "typescript" }} />);
      expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
      expect(html).toContain('aria-label="Copy code to clipboard"');
      if (kind === "terminal") expect(html).toContain("&gt;_</span>");
      if (kind === "file") expect(html).toContain("FILE  app.ts");
      if (kind === "plain") expect(html).toContain("<span>typescript</span>");
    }
  });

  it("renders the step number, title, and inline body", () => {
    expect(renderToStaticMarkup(<StepBlock id="step" props={{ number: 3, title: "Run it", body: "Then **check**." }} />))
      .toContain('3</span><h3>Run it</h3><p>Then <strong>check</strong>.</p>');
  });

  it("maps callout variants to their semantic color classes", () => {
    const classes = ["tip", "warning", "note"].map((variant) => renderToStaticMarkup(<CalloutBlock id={variant} props={{ variant: variant as "tip" | "warning" | "note", title: "Heads up", body: "Details" }} />));
    expect(classes[0]).toContain("lesson-callout--success");
    expect(classes[1]).toContain("lesson-callout--warning");
    expect(classes[2]).toContain("lesson-callout--primary");
  });

  it("renders a divider with the existing markdown rule class", () => {
    expect(renderToStaticMarkup(<DividerBlock id="rule" props={{}} />)).toBe('<hr id="rule" class="lesson-markdown"/>');
  });

  it("gives the copy button its clipboard label", () => {
    expect(renderToStaticMarkup(<CopyButton text="hello" />)).toContain('aria-label="Copy code to clipboard"');
  });

  it("keeps new lesson CSS selectors inside the lesson blocks container", () => {
    const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
    const start = css.lastIndexOf("/* Simple lesson blocks */");
    const additions = css.slice(start, css.indexOf("/* End simple lesson blocks */", start));
    const selectors = additions.split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes("{") && !line.startsWith("@") && !line.startsWith("/*"))
      .flatMap((line) => line.slice(0, line.indexOf("{")).split(",").map((selector) => selector.trim()));
    expect(selectors.length).toBeGreaterThan(0);
    expect(selectors.every((selector) => /^\.lesson-blocks(?:\b|[ >.#:[\]])/.test(selector) || /^\.lb-[\w-]+(?:\b|[ >.#:[\]])/.test(selector))).toBe(true);
  });
});
