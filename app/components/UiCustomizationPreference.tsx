"use client";

import { useLayoutEffect } from "react";
import { getStoredUiCustomization, previewUiCustomization, removeUiCustomizationPreview, subscribeToUiCustomization } from "../lib/ui-customization";

export function UiCustomizationPreference() {
  useLayoutEffect(() => {
    const applyStored = () => {
      const stored = getStoredUiCustomization();
      if (stored) previewUiCustomization(stored);
      else removeUiCustomizationPreview();
    };
    applyStored();
    return subscribeToUiCustomization(applyStored);
  }, []);

  return null;
}
