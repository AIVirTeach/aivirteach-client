"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sidebar } from "../components/Sidebar";
import { api } from "../lib/api";
import { applyInterfaceVersion, getServerInterfaceVersion, getStoredInterfaceVersion, subscribeToInterfaceVersion, type InterfaceVersion } from "../lib/interface-version";
import { applyLearningLanguage, localize, useLearningLanguage, type LearningLanguage } from "../lib/language";
import { applyTheme, getServerTheme, getStoredTheme, subscribeToTheme, type Theme } from "../lib/theme";
import { applyScrollbarPreference, getServerScrollbarPreference, getStoredScrollbarPreference, subscribeToScrollbarPreference, type ScrollbarPreference } from "../lib/scrollbar-preference";

export default function SettingsPage() {
  const router = useRouter();
  const theme = useSyncExternalStore(subscribeToTheme, getStoredTheme, getServerTheme);
  const interfaceVersion = useSyncExternalStore(subscribeToInterfaceVersion, getStoredInterfaceVersion, getServerInterfaceVersion);
  const learningLanguage = useLearningLanguage();
  const t = (english: string, chinese: string) => localize(learningLanguage, english, chinese);
  const scrollbarPreference = useSyncExternalStore(subscribeToScrollbarPreference, getStoredScrollbarPreference, getServerScrollbarPreference);

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

  function chooseLearningLanguage(nextLanguage: LearningLanguage) {
    applyLearningLanguage(nextLanguage);
  }

  function chooseScrollbarPreference(nextPreference: ScrollbarPreference) {
    applyScrollbarPreference(nextPreference);
  }

  function logOut() {
    void api.logout().finally(() => router.replace("/login"));
  }

  return (
    <div className="app-shell">
      <Sidebar active="settings" />
      <main className="settings-page page-content">
        <header className="settings-head">
          <p className="eyebrow">{t("PREFERENCES", "偏好设置")}</p>
          <h1>{t("Settings", "设置")}</h1>
          <p>{t("Personalize how AIVir Teacher looks and works for you.", "个性化 AIVir Teacher 的外观与使用方式。")}</p>
        </header>

        <section className="settings-list" aria-label={t("Application settings", "应用设置")}>
          <Card as="article" className="settings-card">
            <div><span className="settings-card-icon profile-setting-icon" aria-hidden="true" /><div><h2>{t("Profile", "个人资料")}</h2><p>{t("Update your learner name, focus, and demo account details.", "更新学习者姓名、学习方向和演示账户资料。")}</p></div></div>
            <Button render={<Link href="/settings/profile" />} className="settings-card-link" variant="outline">{t("Open profile", "打开资料")}</Button>
          </Card>

          <Card as="article" className="settings-card">
            <div><span className="settings-card-icon version-setting-icon" aria-hidden="true">V</span><div><h2>{t("Design theme", "设计主题")}</h2><p>{t("Choose the visual style used across the frontend.", "选择整个前端使用的视觉风格。")}</p></div></div>
            <label className="design-theme-select">
              <span>{t("Design theme", "设计主题")}</span>
              <select value={interfaceVersion} onChange={(event) => chooseInterfaceVersion(event.target.value as InterfaceVersion)}>
                <option value="v1">{t("Original V1", "原版 V1")}</option>
                <option value="v2">{t("Modern V2", "现代 V2")}</option>
                <option value="soft">{t("Soft neumorphism", "柔和新拟态")}</option>
                <option value="soft-brutal">{t("Soft brutalism", "柔和粗野主义")}</option>
                <option value="brutal">{t("Brutalism", "粗野主义")}</option>
                <option value="neubrutal">{t("Neubrutalism", "新粗野主义")}</option>
              </select>
            </label>
          </Card>

          <Card as="article" className="settings-card">
            <div><span className="settings-card-icon" aria-hidden="true">文</span><div><h2>{t("Language", "语言")}</h2><p>{t("Change the language across AIVirTeach, including Learning Lab V2.", "更改整个 AIVirTeach（包括学习实验室 V2）的语言。")}</p></div></div>
            <div className="theme-choice" role="group" aria-label={t("Application language", "应用语言")}>
              <Button variant="ghost" className={learningLanguage === "en" ? "active" : ""} type="button" onClick={() => chooseLearningLanguage("en")} aria-pressed={learningLanguage === "en"}>English</Button>
              <Button variant="ghost" className={learningLanguage === "zh-CN" ? "active" : ""} type="button" onClick={() => chooseLearningLanguage("zh-CN")} aria-pressed={learningLanguage === "zh-CN"}>简体中文</Button>
            </div>
          </Card>

          <Card as="article" className="settings-card">
            <div><span className="settings-card-icon theme-icon" aria-hidden="true" /><div><h2>{t("Theme", "外观主题")}</h2><p>{t("Choose the appearance that is most comfortable for you.", "选择最适合你的显示外观。")}</p></div></div>
            <div className="theme-choice" role="group" aria-label={t("Color theme", "颜色主题")}>
              <Button variant="ghost" className={theme === "light" ? "active" : ""} type="button" onClick={() => chooseTheme("light")} aria-pressed={theme === "light"}>{t("Light", "浅色")}</Button>
              <Button variant="ghost" className={theme === "dark" ? "active" : ""} type="button" onClick={() => chooseTheme("dark")} aria-pressed={theme === "dark"}>{t("Dark", "深色")}</Button>
            </div>
          </Card>

          <Card as="article" className="settings-card">
            <div><span className="settings-card-icon" aria-hidden="true">↕</span><div><h2>{t("Scrollbars", "滚动条")}</h2><p>{t("Keep thin scrollbars visible for orientation, or hide them for a cleaner workspace.", "显示细滚动条以便定位，或将其隐藏以获得更简洁的工作区。")}</p></div></div>
            <div className="theme-choice" role="group" aria-label={t("Scrollbar visibility", "滚动条显示")}>
              <Button variant="ghost" className={scrollbarPreference === "visible" ? "active" : ""} type="button" onClick={() => chooseScrollbarPreference("visible")} aria-pressed={scrollbarPreference === "visible"}>{t("Visible", "显示")}</Button>
              <Button variant="ghost" className={scrollbarPreference === "hidden" ? "active" : ""} type="button" onClick={() => chooseScrollbarPreference("hidden")} aria-pressed={scrollbarPreference === "hidden"}>{t("Hidden", "隐藏")}</Button>
            </div>
          </Card>

          <Card as="article" className="settings-card">
            <div><span className="settings-card-icon notification-setting-icon" aria-hidden="true" /><div><h2>{t("Notifications", "通知")}</h2><p>{t("Control reminders, milestones, and learning updates.", "管理提醒、里程碑和学习更新。")}</p></div></div>
            <Button variant="outline" type="button" disabled>{t("Manage", "管理")} <small>{t("Coming soon", "即将推出")}</small></Button>
          </Card>

          <Card as="article" className="settings-card">
            <div><span className="settings-card-icon privacy-icon" aria-hidden="true" /><div><h2>{t("Privacy", "隐私")}</h2><p>{t("Manage learning data, profile visibility, and account permissions.", "管理学习数据、资料可见性和账户权限。")}</p></div></div>
            <Button variant="outline" type="button" disabled>{t("Manage", "管理")} <small>{t("Coming soon", "即将推出")}</small></Button>
          </Card>

          <Card as="article" className="settings-card logout-settings-card">
            <div><span className="settings-card-icon logout-setting-icon" aria-hidden="true" /><div><h2>{t("Log out", "退出登录")}</h2><p>{t("Return to the sign-in screen. Your demo progress and preferences will stay saved.", "返回登录页面。你的演示进度和偏好设置会继续保留。")}</p></div></div>
            <Button className="logout-button" variant="destructive" type="button" onClick={logOut}>{t("Log out", "退出登录")}</Button>
          </Card>
        </section>
      </main>
    </div>
  );
}
