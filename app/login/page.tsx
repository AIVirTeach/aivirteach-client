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
import { api } from "../lib/api";
import { backendConfig } from "../lib/config";
import { mockLearners } from "../lib/mock-profile";
import { localize, useLearningLanguage } from "../lib/language";

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState("learner_advanced");
  const isLocal = backendConfig.mode === "local";
  const selectedProfile = mockLearners.find((learner) => learner.id === selectedProfileId) ?? mockLearners[1];
  const language = useLearningLanguage();
  const t = (english: string, chinese: string) => localize(language, english, chinese);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setSubmitting(true);
    try {
      await api.login(
        String(form.get("email") ?? ""),
        String(form.get("password") ?? ""),
        rememberMe,
      );
      router.push("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not log in.");
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <ThemeToggle />
      <div className="login-glow login-glow-one" />
      <div className="login-glow login-glow-two" />
      <section className="login-wrap" aria-labelledby="login-title">
        <header className="login-intro">
          <BrandLogo className="login-logo" />
          <h1 id="login-title">{t("Turn AI Learners into AI Builders", "让 AI 学习者成为 AI 创造者")}</h1>
        </header>
        <Card className="login-card">
          {isLocal && <div className="demo-account-picker">
            <div className="demo-account-heading"><strong>{t("Choose a local demo account", "选择本地演示账户")}</strong><span>{t("No server password is needed", "无需服务器密码")}</span></div>
            <div className="demo-account-options" role="group" aria-label={t("Demo account", "演示账户")}>
              {mockLearners.map((learner) => (
                <Button variant="outline" className={selectedProfileId === learner.id ? "selected" : ""} type="button" key={learner.id} onClick={() => setSelectedProfileId(learner.id)} aria-pressed={selectedProfileId === learner.id}>
                  <strong>{learner.accountType === "all-clear" ? "All clear" : learner.accountType[0].toUpperCase() + learner.accountType.slice(1)}</strong>
                  <span>{learner.name}</span>
                </Button>
              ))}
            </div>
          </div>}
          <form onSubmit={submit}>
            <Label htmlFor="email">{t("Email", "电子邮箱")}</Label>
            <Input id="email" name="email" type="email" placeholder="name@example.com" value={isLocal ? selectedProfile.email : undefined} readOnly={isLocal} autoComplete="email" required />
            {!isLocal && <>
              <div className="label-row"><Label htmlFor="password">{t("Password", "密码")}</Label><button type="button" className="auth-text-link">{t("Forgot password?", "忘记密码？")}</button></div>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
              <Label className="remember"><Checkbox name="remember" checked={rememberMe} onCheckedChange={setRememberMe} /> <span>{t("Remember me", "记住我")}</span></Label>
            </>}
            {error && <Alert className="auth-error" variant="destructive">{error}</Alert>}
            <Button className="primary-button login-submit" size="lg" type="submit" disabled={submitting}>{submitting ? t("Logging in…", "正在登录……") : isLocal ? t("Open local demo", "打开本地演示") : t("Log in", "登录")}</Button>
          </form>
          {!isLocal && <div className="provider-actions" aria-label={t("Alternative sign-in options", "其他登录方式")}>
            <Button className="provider-button" variant="outline" type="button" disabled><span className="google-g">G</span> Google</Button>
            <Button className="provider-button" variant="outline" type="button" disabled><span aria-hidden="true">▥</span> {t("Institutional", "机构登录")}</Button>
          </div>}
        </Card>
        {isLocal
          ? <p className="signup-copy">{t("Need a custom profile?", "需要自定义资料？")} <Button render={<Link href="/create-account" />} className="text-button" variant="link">{t("Create a demo account", "创建演示账户")}</Button></p>
          : <p className="signup-copy activation-copy">{t("Have an invitation?", "已有邀请？")} <Link href="/create-account" className="auth-text-link">{t("Activate your account", "激活账户")}</Link></p>}
      </section>
    </main>
  );
}
