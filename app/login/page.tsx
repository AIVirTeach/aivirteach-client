"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
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
        <div className="login-card">
          {isLocal && <div className="demo-account-picker">
            <div className="demo-account-heading"><strong>Choose a local demo account</strong><span>No server password is needed</span></div>
            <div className="demo-account-options" role="group" aria-label="Demo account">
              {mockLearners.map((learner) => (
                <button className={selectedProfileId === learner.id ? "selected" : ""} type="button" key={learner.id} onClick={() => setSelectedProfileId(learner.id)} aria-pressed={selectedProfileId === learner.id}>
                  <strong>{learner.accountType === "all-clear" ? "All clear" : learner.accountType[0].toUpperCase() + learner.accountType.slice(1)}</strong>
                  <span>{learner.name}</span>
                </button>
              ))}
            </div>
          </div>}
          <form onSubmit={submit}>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" placeholder="name@example.com" value={isLocal ? selectedProfile.email : undefined} readOnly={isLocal} autoComplete="email" required />
            {!isLocal && <>
              <div className="label-row"><label htmlFor="password">Password</label><button type="button" className="text-button">Forgot password?</button></div>
              <input id="password" name="password" type="password" placeholder="••••••••" autoComplete="current-password" required />
              <label className="remember"><input name="remember" type="checkbox" /> <span>Remember me</span></label>
            </>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="primary-button login-submit" type="submit" disabled={submitting}>{submitting ? "Logging in…" : isLocal ? "Open local demo" : "Log in"}</button>
          </form>
          {!isLocal && <>
            <div className="divider"><span>Or continue with</span></div>
            <button className="provider-button" type="button" disabled><span className="google-g">G</span> Google</button>
            <button className="provider-button" type="button" disabled><span aria-hidden="true">▥</span> Institutional Sign In</button>
          </>}
        </div>
        {isLocal
          ? <p className="signup-copy">Need a custom profile? <Link className="text-button" href="/create-account">Create a demo account</Link></p>
          : <p className="signup-copy">Have an invitation? <Link className="text-button" href="/create-account">Activate your account</Link></p>}
      </section>
    </main>
  );
}
