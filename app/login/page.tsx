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
import { Separator } from "@/components/ui/separator";
import { BrandLogo } from "../components/BrandLogo";
import { ThemeToggle } from "../components/ThemeToggle";
import { api } from "../lib/api";
import { backendConfig } from "../lib/config";
import { mockLearners } from "../lib/mock-profile";

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("learner_advanced");
  const isLocal = backendConfig.mode === "local";
  const selectedProfile = mockLearners.find((learner) => learner.id === selectedProfileId) ?? mockLearners[1];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setSubmitting(true);
    try {
      await api.login(
        String(form.get("email") ?? ""),
        String(form.get("password") ?? ""),
        form.get("remember") === "on",
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
          <h1 id="login-title">Turn AI Learners into AI Builders</h1>
        </header>
        <Card className="login-card">
          {isLocal && <div className="demo-account-picker">
            <div className="demo-account-heading"><strong>Choose a local demo account</strong><span>No server password is needed</span></div>
            <div className="demo-account-options" role="group" aria-label="Demo account">
              {mockLearners.map((learner) => (
                <Button variant="outline" className={selectedProfileId === learner.id ? "selected" : ""} type="button" key={learner.id} onClick={() => setSelectedProfileId(learner.id)} aria-pressed={selectedProfileId === learner.id}>
                  <strong>{learner.accountType === "all-clear" ? "All clear" : learner.accountType[0].toUpperCase() + learner.accountType.slice(1)}</strong>
                  <span>{learner.name}</span>
                </Button>
              ))}
            </div>
          </div>}
          <form onSubmit={submit}>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="name@example.com" value={isLocal ? selectedProfile.email : undefined} readOnly={isLocal} autoComplete="email" required />
            {!isLocal && <>
              <div className="label-row"><Label htmlFor="password">Password</Label><Button type="button" variant="link" className="text-button">Forgot password?</Button></div>
              <Input id="password" name="password" type="password" placeholder="••••••••" autoComplete="current-password" required />
              <Label className="remember"><Checkbox name="remember" /> <span>Remember me</span></Label>
            </>}
            {error && <Alert className="auth-error" variant="destructive">{error}</Alert>}
            <Button className="primary-button login-submit" size="lg" type="submit" disabled={submitting}>{submitting ? "Logging in…" : isLocal ? "Open local demo" : "Log in"}</Button>
          </form>
          {!isLocal && <>
            <div className="divider"><Separator className="divider-line" /><span>Or continue with</span><Separator className="divider-line" /></div>
            <Button className="provider-button" variant="outline" size="lg" type="button" disabled><span className="google-g">G</span> Google</Button>
            <Button className="provider-button" variant="outline" size="lg" type="button" disabled><span aria-hidden="true">▥</span> Institutional Sign In</Button>
          </>}
        </Card>
        {isLocal
          ? <p className="signup-copy">Need a custom profile? <Button render={<Link href="/create-account" />} className="text-button" variant="link">Create a demo account</Button></p>
          : <p className="signup-copy">Have an invitation? <Button render={<Link href="/create-account" />} className="text-button" variant="link">Activate your account</Button></p>}
      </section>
    </main>
  );
}
