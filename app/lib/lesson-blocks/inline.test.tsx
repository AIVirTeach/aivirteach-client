import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { isAllowedInlineHref, renderInline } from "./inline";

describe("inline lesson markdown", () => {
  it("renders the supported emphasis markers", () => {
    expect(renderToStaticMarkup(<>{renderInline("**strong** *em* ==highlight== `code`")}</>))
      .toBe("<strong>strong</strong> <em>em</em> <strong>highlight</strong> <code>code</code>");
  });

  it("renders safe web and mail links with the right attributes", () => {
    expect(renderToStaticMarkup(<>{renderInline("[web](HTTPS://example.com) [mail](mailto:a@example.com)")}</>))
      .toBe('<a href="HTTPS://example.com" target="_blank" rel="noopener noreferrer">web</a> <a href="mailto:a@example.com" rel="noopener noreferrer">mail</a>');
  });

  it("rejects unsafe and non-absolute link targets", () => {
    for (const href of ["javascript:alert(1)", "data:text/html,x", "/relative", "//example.com"]) {
      expect(isAllowedInlineHref(href)).toBe(false);
      expect(renderToStaticMarkup(<>{renderInline(`[x](${href})`)}</>)).toBe("x");
    }
  });

  it("escapes markup-like text and supports escaped delimiters", () => {
    expect(renderToStaticMarkup(<>{renderInline("<img src=x onerror=alert(1)> & **ok** \\*not bold\\*")}</>))
      .toBe("&lt;img src=x onerror=alert(1)&gt; &amp; <strong>ok</strong> *not bold*");
  });

  it("unescapes only the documented punctuation", () => {
    expect(renderToStaticMarkup(<>{renderInline("\\\\ \\` \\[ \\] \\= \\*")}</>)).toBe("\\ ` [ ] = *");
  });

  it("supports nested emphasis, line breaks, and literal unclosed markers", () => {
    expect(renderToStaticMarkup(<>{renderInline("**a *b* c**\n**abc")}</>))
      .toBe("<strong>a <em>b</em> c</strong><br/>**abc");
  });

  it("renders an empty string as no markup", () => {
    expect(renderToStaticMarkup(<>{renderInline("")}</>)).toBe("");
  });
});
