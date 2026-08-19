"use client";

import { useLayoutEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useLayoutEffect(() => {
    const savedTheme: Theme = window.localStorage.getItem("aivir-theme") === "dark" ? "dark" : "light";
    setTheme(savedTheme);
    document.documentElement.dataset.theme = savedTheme;
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("aivir-theme", nextTheme);
  }

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button className="auth-theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${nextTheme} theme`} title={`Switch to ${nextTheme} theme`}>
      <span className={theme === "dark" ? "theme-sun" : "theme-moon"} aria-hidden="true" />
    </button>
  );
}
