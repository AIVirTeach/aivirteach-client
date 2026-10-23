import { describe, expect, it } from "vitest";
import { parseFloatingPosition } from "./floating-position";

describe("saved floating button position", () => {
  const fallback = { x: 400, y: 500 };
  it.each([null, [], { x: "12", y: 20 }, { x: 12, y: Number.NaN }, { y: 20 }])("uses the default for malformed JSON value %s", (value) => {
    expect(parseFloatingPosition(value, fallback)).toEqual(fallback);
  });
  it("accepts a finite coordinate pair", () => {
    expect(parseFloatingPosition({ x: 12, y: 20 }, fallback)).toEqual({ x: 12, y: 20 });
  });
});
