import { describe, expect, it } from "vitest";
import { courseDesignMatchesLanguage, getServerLearningLanguage, localize } from "./language";

describe("learning language", () => {
  it("defaults server rendering to English", () => {
    expect(getServerLearningLanguage()).toBe("en");
  });

  it("matches bundled English and Simplified Chinese course documents", () => {
    expect(courseDesignMatchesLanguage("course-theme", "en")).toBe(true);
    expect(courseDesignMatchesLanguage("course-theme-zh-CN", "en")).toBe(false);
    expect(courseDesignMatchesLanguage("course-theme", "zh-CN")).toBe(false);
    expect(courseDesignMatchesLanguage("course-theme-zh-CN", "zh-CN")).toBe(true);
  });

  it("selects application copy from the active language", () => {
    expect(localize("en", "Settings", "设置")).toBe("Settings");
    expect(localize("zh-CN", "Settings", "设置")).toBe("设置");
  });
});
