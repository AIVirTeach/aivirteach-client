"use client";

import { useLayoutEffect } from "react";
import { useLearningLanguage } from "../lib/language";

export function AppLanguage() {
  const language = useLearningLanguage();

  useLayoutEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
  }, [language]);

  return null;
}
