"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { clearUiCustomizationDraft, getPreviewUiCustomization, previewUiCustomization, removeUiCustomizationPreview, subscribeToUiCustomization } from "../lib/ui-customization";
import { getSavedUiCustomization } from "../lib/site-ui-customization";
import { localize, useLearningLanguage } from "../lib/language";

export function UiCustomizationPreference() {
  const [previewing, setPreviewing] = useState(false);
  const language = useLearningLanguage();
  const t = (english: string, chinese: string) => localize(language, english, chinese);

  useLayoutEffect(() => {
    const applyStored = () => {
      const preview = getPreviewUiCustomization();
      const settings = preview ?? getSavedUiCustomization();
      setPreviewing(Boolean(preview));
      if (settings) previewUiCustomization(settings);
      else removeUiCustomizationPreview();
    };
    applyStored();
    return subscribeToUiCustomization(applyStored);
  }, []);

  return previewing ? <aside className="theme-preview-banner" role="status"><span>{t("Theme preview", "主题预览")}</span><Link href="/settings?tab=advanced">{t("Back to editor", "返回编辑器")}</Link><button type="button" onClick={clearUiCustomizationDraft}>{t("Discard", "放弃")}</button></aside> : null;
}
