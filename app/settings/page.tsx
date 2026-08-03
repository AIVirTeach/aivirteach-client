"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";

type Theme = "light" | "dark";

export default function SettingsPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("light");

  useLayoutEffect(() => {
    const savedTheme: Theme = window.localStorage.getItem("aivir-theme") === "dark" ? "dark" : "light";
    setTheme(savedTheme);
    document.documentElement.dataset.theme = savedTheme;
  }, []);

  function chooseTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("aivir-theme", nextTheme);
  }

  return (
    <div className="app-shell">
      <Sidebar active="settings" />
      <main className="settings-page page-content">
        <header className="settings-head">
          <p className="eyebrow">PREFERENCES</p>
          <h1>Settings</h1>
          <p>Personalize how AIVir Teacher looks and works for you.</p>
        </header>

        <section className="settings-list" aria-label="Application settings">
          <article className="settings-card">
            <div><span className="settings-card-icon profile-setting-icon" aria-hidden="true" /><div><h2>Profile</h2><p>Update your learner name, focus, and demo account details.</p></div></div>
            <Link className="settings-card-link" href="/settings/profile">Open profile</Link>
          </article>

          <article className="settings-card">
            <div><span className="settings-card-icon" aria-hidden="true">文</span><div><h2>Language</h2><p>Choose the language used throughout the learning experience.</p></div></div>
            <button type="button" disabled>English <small>Coming soon</small></button>
          </article>

          <article className="settings-card">
            <div><span className="settings-card-icon theme-icon" aria-hidden="true" /><div><h2>Theme</h2><p>Choose the appearance that is most comfortable for you.</p></div></div>
            <div className="theme-choice" role="group" aria-label="Color theme">
              <button className={theme === "light" ? "active" : ""} type="button" onClick={() => chooseTheme("light")} aria-pressed={theme === "light"}>Light</button>
              <button className={theme === "dark" ? "active" : ""} type="button" onClick={() => chooseTheme("dark")} aria-pressed={theme === "dark"}>Dark</button>
            </div>
          </article>

          <article className="settings-card">
            <div><span className="settings-card-icon notification-setting-icon" aria-hidden="true" /><div><h2>Notifications</h2><p>Control reminders, milestones, and learning updates.</p></div></div>
            <button type="button" disabled>Manage <small>Coming soon</small></button>
          </article>

          <article className="settings-card">
            <div><span className="settings-card-icon privacy-icon" aria-hidden="true" /><div><h2>Privacy</h2><p>Manage learning data, profile visibility, and account permissions.</p></div></div>
            <button type="button" disabled>Manage <small>Coming soon</small></button>
          </article>

          <article className="settings-card logout-settings-card">
            <div><span className="settings-card-icon logout-setting-icon" aria-hidden="true" /><div><h2>Log out</h2><p>Return to the sign-in screen. Your demo progress and preferences will stay saved.</p></div></div>
            <button className="logout-button" type="button" onClick={() => router.replace("/login")}>Log out</button>
          </article>
        </section>
      </main>
    </div>
  );
}
