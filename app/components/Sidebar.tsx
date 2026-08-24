"use client";

import Link from "next/link";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { AccountMenu } from "./AccountMenu";
import { AdminAccountMenu } from "./AdminAccountMenu";
import { BrandLogo } from "./BrandLogo";

type SidebarProps = {
  active: "dashboard" | "courses" | "workspace" | "analysis" | "settings" | "analytics" | "course-settings";
  mode?: "learner" | "admin";
};

const learnerItems = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "▦" },
  { id: "courses", label: "Courses", href: "/courses", icon: "▤" },
  { id: "workspace", label: "Learning Lab", href: "/workspace", icon: "‹›" },
  { id: "analysis", label: "Progress", href: "/analysis", icon: "" },
  { id: "settings", label: "Settings", href: "/settings", icon: "⚙" },
] as const;

const adminItems = [
  { id: "analytics", label: "Website Analytics", href: "/admin", icon: "▦" },
  { id: "course-settings", label: "Course Settings", href: "/admin/courses", icon: "▤" },
] as const;

const sidebarStorageKey = "aivir-sidebar-collapsed";
const sidebarChangeEvent = "aivirteach:sidebar-collapsed";
let cachedSidebarCollapsed: boolean | null = null;

function subscribeToSidebar(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(sidebarChangeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(sidebarChangeEvent, callback);
  };
}

function getSidebarSnapshot() {
  cachedSidebarCollapsed ??= window.localStorage.getItem(sidebarStorageKey) === "true";
  return cachedSidebarCollapsed;
}

export function Sidebar({ active, mode = "learner" }: SidebarProps) {
  const collapsed = useSyncExternalStore(subscribeToSidebar, getSidebarSnapshot, () => false);
  const items = mode === "admin" ? adminItems : learnerItems;

  useLayoutEffect(() => {
    const savedTheme = window.localStorage.getItem("aivir-theme") === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = savedTheme;
  }, []);

  function toggleSidebar() {
    cachedSidebarCollapsed = !collapsed;
    window.localStorage.setItem(sidebarStorageKey, String(cachedSidebarCollapsed));
    window.dispatchEvent(new Event(sidebarChangeEvent));
  }

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <header className="sidebar-brand-header">
        <BrandLogo className="sidebar-brand-logo" />
        <button className="sidebar-collapse-toggle" type="button" onClick={toggleSidebar} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} aria-expanded={!collapsed}><span aria-hidden="true" /></button>
      </header>

      <section className="sidebar-content-section" aria-label="Navigation">
        <nav className="side-nav" aria-label={mode === "admin" ? "Admin navigation" : "Primary navigation"}>
          {items.map((item) => (
            <Link key={item.id} href={item.href} className={active === item.id ? "active" : ""} title={collapsed ? item.label : undefined}>
              <span className={`nav-icon ${item.id === "analysis" ? "progress-nav-icon" : ""} ${item.id === "workspace" ? "learning-lab-nav-icon" : ""}`} aria-hidden="true">
                {item.id === "dashboard" || item.id === "analytics" ? <i className="home-nav-icon" /> : item.id === "analysis" ? <i><b /><b /><b /></i> : item.id === "workspace" ? <i className="lab-code-icon"><b /><b /></i> : item.icon}
              </span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>
      </section>

      <section className="sidebar-profile-section" aria-label={mode === "admin" ? "Administrator profile" : "Learner profile"}>
        {mode === "admin" ? <AdminAccountMenu collapsed={collapsed} /> : <AccountMenu placement="sidebar" collapsed={collapsed} />}
      </section>
    </aside>
  );
}
