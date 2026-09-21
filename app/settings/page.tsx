"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sidebar } from "../components/Sidebar";
import { api } from "../lib/api";
import { applyInterfaceVersion, getServerInterfaceVersion, getStoredInterfaceVersion, subscribeToInterfaceVersion, type InterfaceVersion } from "../lib/interface-version";
import { applyTheme, getServerTheme, getStoredTheme, subscribeToTheme, type Theme } from "../lib/theme";

export default function SettingsPage() {
  const router = useRouter();
  const theme = useSyncExternalStore(subscribeToTheme, getStoredTheme, getServerTheme);
  const interfaceVersion = useSyncExternalStore(subscribeToInterfaceVersion, getStoredInterfaceVersion, getServerInterfaceVersion);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  function chooseTheme(nextTheme: Theme) {
    applyTheme(nextTheme);
  }

  function chooseInterfaceVersion(nextVersion: InterfaceVersion) {
    applyInterfaceVersion(nextVersion);
  }

  function logOut() {
    void api.logout().finally(() => router.replace("/login"));
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
          <Card as="article" className="settings-card">
            <div><span className="settings-card-icon profile-setting-icon" aria-hidden="true" /><div><h2>Profile</h2><p>Update your learner name, focus, and demo account details.</p></div></div>
            <Button render={<Link href="/settings/profile" />} className="settings-card-link" variant="outline">Open profile</Button>
          </Card>

          <Card as="article" className="settings-card">
            <div><span className="settings-card-icon version-setting-icon" aria-hidden="true">V</span><div><h2>Interface design</h2><p>Choose the original layout, V2, soft neumorphism, brutalism, or modern neubrutalism.</p></div></div>
            <div className="version-choice" role="group" aria-label="Interface version">
              <Button variant="ghost" className={interfaceVersion === "v1" ? "active" : ""} type="button" onClick={() => chooseInterfaceVersion("v1")} aria-pressed={interfaceVersion === "v1"}>V1</Button>
              <Button variant="ghost" className={interfaceVersion === "v2" ? "active" : ""} type="button" onClick={() => chooseInterfaceVersion("v2")} aria-pressed={interfaceVersion === "v2"}>V2</Button>
              <Button variant="ghost" className={interfaceVersion === "soft" ? "active" : ""} type="button" onClick={() => chooseInterfaceVersion("soft")} aria-pressed={interfaceVersion === "soft"}>Soft</Button>
              <Button variant="ghost" className={interfaceVersion === "brutal" ? "active" : ""} type="button" onClick={() => chooseInterfaceVersion("brutal")} aria-pressed={interfaceVersion === "brutal"}>Brutal</Button>
              <Button variant="ghost" className={interfaceVersion === "neubrutal" ? "active" : ""} type="button" onClick={() => chooseInterfaceVersion("neubrutal")} aria-pressed={interfaceVersion === "neubrutal"}>Neubrutal</Button>
            </div>
          </Card>

          <Card as="article" className="settings-card">
            <div><span className="settings-card-icon" aria-hidden="true">文</span><div><h2>Language</h2><p>Choose the language used throughout the learning experience.</p></div></div>
            <Button variant="outline" type="button" disabled>English <small>Coming soon</small></Button>
          </Card>

          <Card as="article" className="settings-card">
            <div><span className="settings-card-icon theme-icon" aria-hidden="true" /><div><h2>Theme</h2><p>Choose the appearance that is most comfortable for you.</p></div></div>
            <div className="theme-choice" role="group" aria-label="Color theme">
              <Button variant="ghost" className={theme === "light" ? "active" : ""} type="button" onClick={() => chooseTheme("light")} aria-pressed={theme === "light"}>Light</Button>
              <Button variant="ghost" className={theme === "dark" ? "active" : ""} type="button" onClick={() => chooseTheme("dark")} aria-pressed={theme === "dark"}>Dark</Button>
            </div>
          </Card>

          <Card as="article" className="settings-card">
            <div><span className="settings-card-icon notification-setting-icon" aria-hidden="true" /><div><h2>Notifications</h2><p>Control reminders, milestones, and learning updates.</p></div></div>
            <Button variant="outline" type="button" disabled>Manage <small>Coming soon</small></Button>
          </Card>

          <Card as="article" className="settings-card">
            <div><span className="settings-card-icon privacy-icon" aria-hidden="true" /><div><h2>Privacy</h2><p>Manage learning data, profile visibility, and account permissions.</p></div></div>
            <Button variant="outline" type="button" disabled>Manage <small>Coming soon</small></Button>
          </Card>

          <Card as="article" className="settings-card logout-settings-card">
            <div><span className="settings-card-icon logout-setting-icon" aria-hidden="true" /><div><h2>Log out</h2><p>Return to the sign-in screen. Your demo progress and preferences will stay saved.</p></div></div>
            <Button className="logout-button" variant="destructive" type="button" onClick={logOut}>Log out</Button>
          </Card>
        </section>
      </main>
    </div>
  );
}
