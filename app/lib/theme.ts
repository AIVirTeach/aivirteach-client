export type Theme = "light" | "dark";

import { getCommittedTheme } from "./site-ui-customization";

const themeStorageKey = "aivir-theme";
const previewStorageKey = "aivir-theme-preview";
const themeChangeEvent = "aivirteach:theme-change";

export function getStoredTheme(): Theme {
  const stored = window.sessionStorage.getItem(previewStorageKey) ?? window.localStorage.getItem(themeStorageKey);
  return stored === "dark" ? "dark" : stored === "light" ? "light" : getCommittedTheme();
}

export function getServerTheme(): Theme {
  return getCommittedTheme();
}

export function subscribeToTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(themeChangeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(themeChangeEvent, callback);
  };
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.sessionStorage.removeItem(previewStorageKey);
  window.localStorage.setItem(themeStorageKey, theme);
  window.dispatchEvent(new Event(themeChangeEvent));
}

export function previewTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.sessionStorage.setItem(previewStorageKey, theme);
  window.dispatchEvent(new Event(themeChangeEvent));
}

export function clearThemePreview() {
  window.sessionStorage.removeItem(previewStorageKey);
  window.dispatchEvent(new Event(themeChangeEvent));
}

export function clearStoredTheme() {
  window.localStorage.removeItem(themeStorageKey);
}
