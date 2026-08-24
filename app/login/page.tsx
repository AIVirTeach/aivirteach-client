"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "../components/BrandLogo";
import { ThemeToggle } from "../components/ThemeToggle";
import { api } from "../lib/api";
import { backendConfig } from "../lib/config";
import { mockLearners } from "../lib/mock-profile";

const adminEmail = "admin@aiverteach.edu";
const adminDemoProfile = { id: "admin", email: adminEmail, name: "Administrator", accountType: "admin" as const };

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("learner_advanced");
  const isLocal = backendConfig.mode === "local";
  const loginProfiles = [...mockLearners, adminDemoProfile];
  const selectedProfile = loginProfiles.find((profile) => profile.id === selectedProfileId) ?? mockLearners[1];
  const adminSelected = selectedProfile.id === adminDemoProfile.id;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setSubmitting(true);
    try {
      const email = String(form.get("email") ?? "").trim();
      const isAdminEmail = email.toLowerCase() === adminEmail;
      if (!(isLocal && isAdminEmail)) {
        await api.login(email, String(form.get("password") ?? ""), form.get("remember") === "on");
      }
      router.push(isAdminEmail ? "/admin" : "/dashboard");
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
              {loginProfiles.map((profile) => (
                <button className={`${selectedProfileId === profile.id ? "selected" : ""} ${profile.id === "admin" ? "admin-demo-option" : ""}`.trim()} type="button" key={profile.id} onClick={() => setSelectedProfileId(profile.id)} aria-pressed={selectedProfileId === profile.id}>
                  <strong>{profile.accountType === "all-clear" ? "All clear" : profile.accountType === "admin" ? "Admin workspace" : profile.accountType[0].toUpperCase() + profile.accountType.slice(1)}</strong>
                  <span>{profile.name}</span>
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
            <button className="primary-button login-submit" type="submit" disabled={submitting}>{submitting ? "Logging in…" : adminSelected ? "Open admin workspace" : isLocal ? "Open local demo" : "Log in"}</button>
          </form>
          {!isLocal && <>
            <div className="divider"><span>Or continue with</span></div>
            <button className="provider-button" type="button" disabled><span className="google-g">G</span> Google</button>
            <button className="provider-button" type="button" disabled><span aria-hidden="true">▥</span> Institutional Sign In</button>
          </>}
        </div>
        <div className="login-footer-links">
          {adminSelected
            ? <p className="signup-copy">Administrator preview selected.</p>
            : isLocal
            ? <p className="signup-copy">Need a custom profile? <Link className="text-button" href="/create-account">Create a demo account</Link></p>
            : <p className="signup-copy">Have an invitation? <Link className="text-button" href="/create-account">Activate your account</Link></p>}
          <p className="admin-login-copy">Administrators sign in here with <strong>{adminEmail}</strong>.</p>
        </div>
      </section>
    </main>
  );
}
