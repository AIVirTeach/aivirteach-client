"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLearnerProfile } from "../hooks/useLearnerProfile";
import { api } from "../lib/api";
import { Avatar } from "./Avatar";

type AccountMenuProps = { placement: "sidebar" | "lab"; collapsed?: boolean; onVmEnv?: () => void };
type Theme = "light" | "dark";

export function AccountMenu({ placement, collapsed = false, onVmEnv }: AccountMenuProps) {
  const router = useRouter();
  const { profile, loading } = useLearnerProfile();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const savedTheme: Theme = window.localStorage.getItem("aivir-theme") === "dark" ? "dark" : "light";
    setTheme(savedTheme);
    document.documentElement.dataset.theme = savedTheme;
  }, []);

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
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("aivir-theme", nextTheme);
  }

  if (loading) {
    return (
      <div className={`account-menu account-menu-${placement}`}>
        <div className="profile-block sidebar-profile-loading" role="status" aria-label="Loading learner profile">
          <span className="profile-loading-avatar" aria-hidden="true" />
          <span className="profile-summary" aria-hidden="true"><i /><i /><i /></span>
        </div>
      </div>
    );
  }

  return (
    <div className={`account-menu account-menu-${placement}`} ref={containerRef}>
      {open && (
        <div className="account-dropdown" role="menu" aria-label="Account menu">
          {placement === "lab" ? <>
            <button className="account-theme-toggle" type="button" role="menuitemcheckbox" aria-checked={theme === "dark"} onClick={toggleTheme}>
              <span className={theme === "dark" ? "theme-sun" : "theme-moon"} aria-hidden="true" />
              <span>Dark mode</span>
              <span className="account-theme-switch" aria-hidden="true"><span /></span>
            </button>
            <button type="button" role="menuitem" onClick={() => { setOpen(false); onVmEnv?.(); }}>VM Env</button>
            <Link className="account-menu-exit" href="/courses" role="menuitem">Exit Learning Lab</Link>
          </> : <>
            <Link href="/settings/profile" role="menuitem" onClick={() => setOpen(false)}>Profile Settings</Link>
            <button type="button" role="menuitem" onClick={() => void api.logout().finally(() => router.replace("/login"))}>Sign out</button>
          </>}
        </div>
      )}
      <button className="profile-block profile-trigger account-menu-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu" aria-label={collapsed ? `${profile.name} account menu` : undefined}>
        <Avatar size={placement === "lab" ? "medium" : "large"} name={profile.name} src={profile.avatar} />
        <span className="profile-summary">
          <strong>{profile.name}</strong>
          <span>{placement === "lab" ? profile.role : `${profile.plan} Learner`}</span>
          {placement === "sidebar" && <em>Level {profile.level}</em>}
        </span>
        <span className="account-menu-chevron" aria-hidden="true" />
      </button>
    </div>
  );
}
