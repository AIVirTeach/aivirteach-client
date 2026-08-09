"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLearnerProfile } from "../hooks/useLearnerProfile";
import { Avatar } from "./Avatar";

type AccountMenuProps = { placement: "sidebar" | "lab"; collapsed?: boolean };

export function AccountMenu({ placement, collapsed = false }: AccountMenuProps) {
  const { profile, loading } = useLearnerProfile();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
          <Link href="/settings/profile" role="menuitem" onClick={() => setOpen(false)}>Profile Settings</Link>
          {placement === "lab" ? <Link className="account-menu-exit" href="/courses" role="menuitem">Exit Learning Lab</Link> : <Link href="/login" role="menuitem">Sign out</Link>}
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
