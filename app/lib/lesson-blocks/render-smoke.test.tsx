import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import canonicalLesson from "./__fixtures__/canonical-lesson.json";

describe("lesson block client foundation", () => {
  it("renders TSX with the automatic JSX runtime", () => {
    expect(renderToStaticMarkup(<div>ok</div>)).toBe("<div>ok</div>");
  });

  it("keeps all thirteen canonical block types in the shared fixture", () => {
    expect(canonicalLesson.fixtureVersion).toBe(1);
    expect(canonicalLesson.valid.schemaVersion).toBe(1);
    expect(new Set(canonicalLesson.valid.blocks.map((block) => block.type)).size).toBe(13);
  });
});
