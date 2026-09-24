"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { applyTheme, getServerTheme, getStoredTheme, subscribeToTheme } from "../lib/theme";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getStoredTheme, getServerTheme);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  function toggleTheme() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <Button className="auth-theme-toggle" variant="ghost" size="icon" type="button" onClick={toggleTheme} aria-label={`Switch to ${nextTheme} theme`} title={`Switch to ${nextTheme} theme`}>
      <span className={theme === "dark" ? "theme-sun" : "theme-moon"} aria-hidden="true" />
    </Button>
  );
}
