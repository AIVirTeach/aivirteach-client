"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "../components/BrandLogo";
import { ThemeToggle } from "../components/ThemeToggle";
import { api, setDemoUserId } from "../lib/api";
import { backendConfig } from "../lib/config";
import { localize, useLearningLanguage } from "../lib/language";

export default function CreateAccountPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const isLocal = backendConfig.mode === "local";
  const language = useLearningLanguage();
  const t = (english: string, chinese: string) => localize(language, english, chinese);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (password !== confirmation) {
      setError(t("The passwords do not match. Please try again.", "两次输入的密码不一致，请重试。"));
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      if (isLocal) {
        const learner = await api.createDemoUser({ name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") });
        setDemoUserId(learner.id);
        router.push("/courses");
      } else {
        await api.acceptInvitation(String(form.get("token") ?? ""), password);
        router.push("/dashboard");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not activate the account.");
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page create-account-page">
      <ThemeToggle />
      <div className="login-glow login-glow-one" />
      <div className="login-glow login-glow-two" />
      <section className="login-wrap" aria-labelledby="create-account-title">
        <header className="login-intro">
          <BrandLogo className="login-logo" />
          <h1 id="create-account-title">{isLocal ? t("Create a local demo account", "创建本地演示账户") : t("Activate your learner account", "激活学习者账户")}</h1>
          <p>{isLocal ? t("Create a development profile in your local backend.", "在本地后端创建开发资料。") : t("Use the one-time invitation token supplied by AIVirTeach.", "使用 AIVirTeach 提供的一次性邀请码。")}</p>
        </header>
        <Card className="login-card">
          <form onSubmit={submit}>
            {isLocal ? <>
              <Label htmlFor="name">{t("Full name", "姓名")}</Label>
              <Input id="name" name="name" type="text" placeholder={t("Your name", "你的姓名")} autoComplete="name" required />
              <Label className="auth-spaced-label" htmlFor="signup-email">{t("Email", "电子邮箱")}</Label>
              <Input id="signup-email" name="email" type="email" placeholder="name@example.com" autoComplete="email" required />
            </> : <>
              <Label htmlFor="invitation-token">{t("Invitation token", "邀请码")}</Label>
              <Input id="invitation-token" name="token" type="text" placeholder={t("Paste your invitation token", "粘贴你的邀请码")} autoComplete="off" required />
            </>}
            {!isLocal && <>
              <Label className="auth-spaced-label" htmlFor="signup-password">{t("Password", "密码")}</Label>
              <Input id="signup-password" name="password" type="password" placeholder={t("At least 8 characters", "至少 8 个字符")} autoComplete="new-password" minLength={8} required />
              <Label className="auth-spaced-label" htmlFor="confirmation">{t("Confirm password", "确认密码")}</Label>
              <Input id="confirmation" name="confirmation" type="password" placeholder={t("Repeat your password", "再次输入密码")} autoComplete="new-password" minLength={8} required />
              <Label className="remember signup-terms"><Checkbox required /> <span>{t("I agree to the Terms and Privacy Policy", "我同意条款和隐私政策")}</span></Label>
            </>}
            {error && <Alert className="auth-error" variant="destructive">{error}</Alert>}
            <Button className="primary-button login-submit" size="lg" type="submit" disabled={submitting}>{submitting ? (isLocal ? t("Creating account…", "正在创建账户……") : t("Activating account…", "正在激活账户……")) : (isLocal ? t("Create demo account", "创建演示账户") : t("Activate account", "激活账户"))}</Button>
          </form>
        </Card>
        <p className="signup-copy">{isLocal ? t("Already have a demo profile?", "已有演示资料？") : t("Already activated?", "已经激活？")} <Button render={<Link href="/login" />} className="text-button" variant="link">{t("Log in", "登录")}</Button></p>
      </section>
    </main>
  );
}
