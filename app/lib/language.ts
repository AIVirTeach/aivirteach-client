import { useSyncExternalStore } from "react";

export type LearningLanguage = "en" | "zh-CN";

const languageStorageKey = "aivirteach.learning-language";
const languageChangeEvent = "aivirteach:learning-language-change";

export function getStoredLearningLanguage(): LearningLanguage {
  return window.localStorage.getItem(languageStorageKey) === "zh-CN" ? "zh-CN" : "en";
}

export function getServerLearningLanguage(): LearningLanguage {
  return "en";
}

export function subscribeToLearningLanguage(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(languageChangeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(languageChangeEvent, callback);
  };
}

export function applyLearningLanguage(language: LearningLanguage) {
  window.localStorage.setItem(languageStorageKey, language);
  window.dispatchEvent(new Event(languageChangeEvent));
}

export function useLearningLanguage() {
  return useSyncExternalStore(subscribeToLearningLanguage, getStoredLearningLanguage, getServerLearningLanguage);
}

export function localize(language: LearningLanguage, english: string, chinese: string) {
  return language === "zh-CN" ? chinese : english;
}

export function courseDesignMatchesLanguage(designId: string, language: LearningLanguage) {
  const isSimplifiedChinese = designId.toLowerCase().endsWith("-zh-cn");
  return language === "zh-CN" ? isSimplifiedChinese : !isSimplifiedChinese;
}
