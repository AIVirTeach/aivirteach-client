"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { useMockProfile } from "../hooks/useMockProfile";
import { Avatar } from "./Avatar";
import { BrandLogo } from "./BrandLogo";

type SidebarProps = { active: "dashboard" | "courses" | "workspace" | "analysis" | "settings" };

const items = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "▦" },
  { id: "courses", label: "Courses", href: "/courses", icon: "▤" },
  { id: "workspace", label: "Learning Lab", href: "/workspace", icon: "‹›" },
  { id: "analysis", label: "Progress", href: "/analysis", icon: "" },
  { id: "settings", label: "Settings", href: "/settings", icon: "⚙" },
] as const;

let cachedSidebarCollapsed: boolean | null = null;

export function Sidebar({ active }: SidebarProps) {
  const { profile } = useMockProfile();
  const [collapsed, setCollapsed] = useState(() => cachedSidebarCollapsed ?? false);

  useLayoutEffect(() => {
    if (cachedSidebarCollapsed === null) cachedSidebarCollapsed = window.localStorage.getItem("aivir-sidebar-collapsed") === "true";
    setCollapsed(cachedSidebarCollapsed);
    const savedTheme = window.localStorage.getItem("aivir-theme") === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = savedTheme;
  }, []);

  function toggleSidebar() {
    setCollapsed((value) => {
      const nextValue = !value;
      cachedSidebarCollapsed = nextValue;
      window.localStorage.setItem("aivir-sidebar-collapsed", String(nextValue));
      return nextValue;
    });
  }

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <header className="sidebar-brand-header">
        <BrandLogo className="sidebar-brand-logo" />
        <button className="sidebar-collapse-toggle" type="button" onClick={toggleSidebar} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} aria-expanded={!collapsed}><span aria-hidden="true" /></button>
      </header>

      <section className="sidebar-profile-section" aria-label="Learner profile">
        <Link className="profile-block profile-trigger" href="/settings/profile" aria-label={collapsed ? `${profile.name} profile` : undefined}>
          <Avatar size="large" name={profile.name} src={profile.avatar} />
          <span className="profile-summary">
            <strong>{profile.name}</strong>
            <span>{profile.plan} Learner</span>
            <em>Level {profile.level}</em>
          </span>
        </Link>
      </section>

      <section className="sidebar-content-section" aria-label="Navigation">
        <nav className="side-nav" aria-label="Primary navigation">
          {items.map((item) => (
            <Link key={item.id} href={item.href} className={active === item.id ? "active" : ""} title={collapsed ? item.label : undefined}>
              <span className={`nav-icon ${item.id === "analysis" ? "progress-nav-icon" : ""} ${item.id === "workspace" ? "learning-lab-nav-icon" : ""}`} aria-hidden="true">
                {item.id === "analysis" ? <i><b /><b /><b /></i> : item.id === "workspace" ? <i className="lab-code-icon"><b /><b /></i> : item.icon}
              </span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>
      </section>
    </aside>
  );
}
