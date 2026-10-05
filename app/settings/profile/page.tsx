"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "../../components/Avatar";
import { Sidebar } from "../../components/Sidebar";
import { useLearnerProfile } from "../../hooks/useLearnerProfile";
import { api } from "../../lib/api";
import { localize, useLearningLanguage } from "../../lib/language";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { profile, updateIdentity, resetProfile } = useLearnerProfile();
  const [status, setStatus] = useState("");
  const language = useLearningLanguage();
  const t = (english: string, chinese: string) => localize(language, english, chinese);
  // Mock learners store `joinedAt` as a bare date ("2026-05-18"); the real
  // backend sends a full ISO timestamp (`user.createdAt.toISOString()`).
  // Appending "T00:00:00" to the latter breaks Date parsing, so only do it
  // for the bare-date shape.
  const joinedAtDate = new Date(profile.joinedAt.includes("T") ? profile.joinedAt : `${profile.joinedAt}T00:00:00`);
  const memberSince = joinedAtDate.toLocaleDateString(language === "zh-CN" ? "zh-CN" : "en-MY", { month: "long", year: "numeric" });

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await updateIdentity(String(form.get("name") ?? ""), String(form.get("role") ?? ""));
      setStatus(t("Profile saved.", "个人资料已保存。"));
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Profile could not be saved.");
    }
  }

  async function resetDemoProfile() {
    try {
      await resetProfile();
      setStatus(t("Demo profile reset.", "演示资料已重置。"));
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Profile could not be reset.");
    }
  }

  return (
    <div className="app-shell">
      <Sidebar active="settings" />
      <main className="profile-settings-page page-content">
        <header className="profile-settings-head">
          <Button render={<Link href="/settings" />} variant="link">← {t("Settings", "设置")}</Button>
          <p className="eyebrow">{t("ACCOUNT", "账户")}</p>
          <h1>{t("Your profile", "你的个人资料")}</h1>
          <p>{t("Manage the learner identity used throughout your demo experience.", "管理演示体验中使用的学习者身份。")}</p>
        </header>

        <Card as="section" className="profile-settings-card">
          <div className="profile-settings-summary">
            <Avatar size="large" name={profile.name} src={profile.avatar} />
            <div><h2>{profile.name}</h2><p>{profile.plan} Learner · Level {profile.level}</p><small>{profile.email}</small></div>
          </div>

          <div className="profile-settings-facts">
            <span><small>{t("Member since", "加入时间")}</small><strong>{memberSince}</strong></span>
            <span><small>{t("Timezone", "时区")}</small><strong>{t("Kuala Lumpur", "吉隆坡")}</strong></span>
          </div>

          <form key={`${profile.name}-${profile.role}`} onSubmit={saveProfile}>
            <Label>{t("Name", "姓名")}<Input name="name" defaultValue={profile.name} autoComplete="name" /></Label>
            <Label>{t("Email", "电子邮箱")}<Input value={profile.email} readOnly /></Label>
            <Label>{t("Learning focus", "学习方向")}<Input name="role" defaultValue={profile.role} /></Label>
            <div className="profile-form-actions">
              <Button className="primary-button" size="lg" type="submit">{t("Save profile", "保存资料")}</Button>
              <Button className="profile-reset-button" variant="destructive" size="lg" type="button" onClick={resetDemoProfile}>{t("Reset demo data", "重置演示数据")}</Button>
              <Button className="profile-logout-button" variant="destructive" size="lg" type="button" onClick={() => void api.logout().finally(() => router.replace("/login"))}>{t("Log out", "退出登录")}</Button>
            </div>
            {status && <p className="profile-save-status" role="status">{status}</p>}
          </form>
        </Card>
      </main>
    </div>
  );
}
