"use client";

import { Sidebar } from "../components/Sidebar";

type AdminShellProps = {
  active: "analytics" | "course-settings";
  children: React.ReactNode;
  title: string;
  description: string;
  actions?: React.ReactNode;
};

export function AdminShell({ active, children, title, description, actions }: AdminShellProps) {
  return (
    <div className="app-shell dashboard-shell admin-shared-shell">
      <Sidebar mode="admin" active={active} />
      <main className="dashboard page-content admin-shared-page">
        <header className="dashboard-toolbar admin-shared-toolbar">
          <span className="admin-workspace-label"><i aria-hidden="true" /> Admin workspace</span>
          {actions && <div className="admin-shared-actions">{actions}</div>}
        </header>
        <section className="welcome-copy admin-page-intro">
          <h1>{title}</h1>
          <p>{description}</p>
        </section>
        {children}
      </main>
    </div>
  );
}
