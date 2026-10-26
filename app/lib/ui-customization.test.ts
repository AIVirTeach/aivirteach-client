// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import {
  clearUiCustomization,
  clearUiCustomizationDraft,
  defaultUiCustomization,
  getPreviewUiCustomization,
  getStoredUiCustomization,
  previewDraftUiCustomization,
  previewUiCustomization,
  removeUiCustomizationPreview,
  saveUiCustomization,
} from "./ui-customization";

afterEach(() => clearUiCustomization());

it("adds Learning Path defaults to older saved settings", () => {
  localStorage.setItem("aivirteach-ui-customization", JSON.stringify({ buttonBackground: "#123456" }));
  const settings = getStoredUiCustomization();
  expect(settings?.buttonBackground).toBe("#123456");
  expect(settings?.learningPathButtonBackground).toBe(defaultUiCustomization.learningPathButtonBackground);
  expect(settings?.learningPathButtonFocusBackground).toBe(defaultUiCustomization.learningPathButtonFocusBackground);
  expect(settings?.learningPathButtonShadow).toBe(true);
});

it("persists the Learning Path style and previews the shadow toggle", () => {
  const settings = { ...defaultUiCustomization, learningPathButtonBackground: "#abcdef", learningPathButtonFocusBackground: "#fedcba", learningPathButtonHeight: 58, learningPathButtonShadow: false };
  saveUiCustomization(settings);
  expect(getStoredUiCustomization()).toMatchObject({ learningPathButtonBackground: "#abcdef", learningPathButtonFocusBackground: "#fedcba", learningPathButtonHeight: 58, learningPathButtonShadow: false });
  expect(document.documentElement.style.getPropertyValue("--ui-learning-path-button-focus-bg")).toBe("#fedcba");
  expect(document.documentElement.style.getPropertyValue("--ui-learning-path-button-height")).toBe("58px");
  expect(document.documentElement.style.getPropertyValue("--ui-learning-path-button-shadow")).toBe("none");

  previewUiCustomization({ ...settings, learningPathButtonShadow: true });
  expect(document.documentElement.style.getPropertyValue("--ui-learning-path-button-shadow")).toContain("3px 3px 0");
  removeUiCustomizationPreview();
  expect(document.documentElement.style.getPropertyValue("--ui-learning-path-button-shadow")).toBe("");
});

it("keeps an unsaved preview across navigation in the same tab", () => {
  previewDraftUiCustomization({ ...defaultUiCustomization, learningPathButtonBackground: "#654321" });
  expect(getPreviewUiCustomization()?.learningPathButtonBackground).toBe("#654321");
  expect(getStoredUiCustomization()).toBeNull();
  clearUiCustomizationDraft();
  expect(getPreviewUiCustomization()).toBeNull();
});
