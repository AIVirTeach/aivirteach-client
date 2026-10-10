"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { getServerTheme, getStoredTheme, subscribeToTheme } from "../lib/theme";

export function ThemePreference() {
  const theme = useSyncExternalStore(subscribeToTheme, getStoredTheme, getServerTheme);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return null;
}
