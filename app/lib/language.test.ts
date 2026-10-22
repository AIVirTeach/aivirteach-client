import { describe, expect, it } from "vitest";
import { getServerLearningLanguage, localize } from "./language";

describe("learning language", () => {
  it("defaults server rendering to English", () => {
    expect(getServerLearningLanguage()).toBe("en");
  });

  it("selects application copy from the active language", () => {
    expect(localize("en", "Settings", "设置")).toBe("Settings");
    expect(localize("zh-CN", "Settings", "设置")).toBe("设置");
  });
});
