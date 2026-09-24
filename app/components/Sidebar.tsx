"use client";

import Link from "next/link";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getServerInterfaceVersion, getStoredInterfaceVersion, subscribeToInterfaceVersion } from "../lib/interface-version";
import { AccountMenu } from "./AccountMenu";
import { BrandLogo } from "./BrandLogo";
import { NotificationMenu } from "./NotificationMenu";
import { TopbarSearch } from "./TopbarSearch";

type SidebarProps = { active: "dashboard" | "courses" | "workspace" | "analysis" | "settings" };

const items = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "▦" },
  { id: "courses", label: "Courses", href: "/courses", icon: "▤" },
  { id: "workspace", label: "Learning Lab", href: "/workspace", icon: "‹›" },
  { id: "analysis", label: "Progress", href: "/analysis", icon: "" },
  { id: "settings", label: "Settings", href: "/settings", icon: "⚙" },
] as const;

const sidebarStorageKey = "aivir-sidebar-collapsed";
const sidebarChangeEvent = "aivirteach:sidebar-collapsed";

function subscribeToSidebar(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(sidebarChangeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(sidebarChangeEvent, callback);
  };
}

function getSidebarSnapshot() {
  return window.localStorage.getItem(sidebarStorageKey) === "true";
}

export function Sidebar({ active }: SidebarProps) {
  const interfaceVersion = useSyncExternalStore(subscribeToInterfaceVersion, getStoredInterfaceVersion, getServerInterfaceVersion);
  const collapsed = useSyncExternalStore(subscribeToSidebar, getSidebarSnapshot, () => false);

  useLayoutEffect(() => {
    const savedTheme = window.localStorage.getItem("aivir-theme") === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = savedTheme;
    document.documentElement.classList.toggle("dark", savedTheme === "dark");
    document.documentElement.dataset.interfaceVersion = interfaceVersion;
  }, [interfaceVersion]);

  function toggleSidebar() {
    const nextCollapsed = !collapsed;
    window.localStorage.setItem(sidebarStorageKey, String(nextCollapsed));
    window.dispatchEvent(new Event(sidebarChangeEvent));
  }

  if (interfaceVersion === "v1") {
    return (
      <Card as="aside" className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
        <header className="sidebar-brand-header">
          <BrandLogo className="sidebar-brand-logo" />
          <Button className="sidebar-collapse-toggle" variant="ghost" size="icon" type="button" onClick={toggleSidebar} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} aria-expanded={!collapsed}><span aria-hidden="true" /></Button>
        </header>

        <section className="sidebar-content-section" aria-label="Navigation">
          <nav className="side-nav" aria-label="Primary navigation">
            {items.map((item) => (
              <Button key={item.id} render={<Link href={item.href} />} variant="ghost" className={active === item.id ? "active" : ""} title={collapsed ? item.label : undefined}>
                <span className={`nav-icon ${item.id === "analysis" ? "progress-nav-icon" : ""} ${item.id === "workspace" ? "learning-lab-nav-icon" : ""}`} aria-hidden="true">
                  {item.id === "dashboard" ? <i className="home-nav-icon" /> : item.id === "analysis" ? <i><b /><b /><b /></i> : item.id === "workspace" ? <i className="lab-code-icon"><b /><b /></i> : item.icon}
                </span>
                <span className="nav-label">{item.label}</span>
              </Button>
            ))}
          </nav>
        </section>

        <section className="sidebar-profile-section" aria-label="Learner profile">
          <AccountMenu placement="sidebar" collapsed={collapsed} />
        </section>
      </Card>
    );
  }

  return (
    <Card as="header" className="topbar">
      <div className="topbar-inner">
        <Link className="topbar-brand" href="/dashboard" aria-label="AIVirTeach dashboard">
          <BrandLogo className="topbar-brand-logo" />
        </Link>

        <nav className="top-nav" aria-label="Primary navigation">
          {items.map((item) => (
            <Button key={item.id} render={<Link href={item.href} />} variant="ghost" className={active === item.id ? "active" : ""}>
              <span className="nav-label">{item.label}</span>
            </Button>
          ))}
        </nav>

        <div className="topbar-actions">
          <NotificationMenu placement="topbar" />
          <TopbarSearch />
          <section className="topbar-profile" aria-label="Learner profile">
            <AccountMenu placement="topbar" />
          </section>
        </div>
      </div>
    </Card>
  );
}
