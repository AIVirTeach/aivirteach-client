"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Avatar } from "./Avatar";

type Theme = "light" | "dark";
const themeChangeEvent = "aivirteach:theme-change";
let cachedTheme: Theme | null = null;

function subscribeToTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(themeChangeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(themeChangeEvent, callback);
  };
}

function getThemeSnapshot(): Theme {
  cachedTheme ??= window.localStorage.getItem("aivir-theme") === "dark" ? "dark" : "light";
  return cachedTheme;
}

export function AdminAccountMenu({ collapsed = false }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => "light");
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    cachedTheme = nextTheme;
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("aivir-theme", nextTheme);
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  return (
    <div className="account-menu account-menu-sidebar" ref={containerRef}>
      {open && (
        <div className="account-dropdown" role="menu" aria-label="Administrator account menu">
          <button className="account-theme-toggle" type="button" role="menuitemcheckbox" aria-checked={theme === "dark"} onClick={toggleTheme}>
            <span className={theme === "dark" ? "theme-sun" : "theme-moon"} aria-hidden="true" />
            <span>Dark mode</span>
            <span className="account-theme-switch" aria-hidden="true"><span /></span>
          </button>
          <Link className="account-menu-exit" href="/login" role="menuitem">Sign out</Link>
        </div>
      )}
      <button className="profile-block profile-trigger account-menu-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu" aria-label={collapsed ? "Administrator account menu" : undefined}>
        <Avatar size="large" name="Administrator" />
        <span className="profile-summary">
          <strong>Administrator</strong>
          <span>Content Manager</span>
          <em>Admin Console</em>
        </span>
        <span className="account-menu-chevron" aria-hidden="true" />
      </button>
    </div>
  );
}
