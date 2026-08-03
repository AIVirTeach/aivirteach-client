"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "../components/BrandLogo";
import { ThemeToggle } from "../components/ThemeToggle";
import { useMockProfile } from "../hooks/useMockProfile";
import { mockLearners } from "../lib/mock-profile";

export default function LoginPage() {
  const router = useRouter();
  const { selectMockProfile } = useMockProfile();
  const [selectedProfileId, setSelectedProfileId] = useState("learner_advanced");
  const [submitting, setSubmitting] = useState(false);
  const selectedProfile = mockLearners.find((learner) => learner.id === selectedProfileId) ?? mockLearners[1];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    selectMockProfile(selectedProfileId);
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    router.push("/dashboard");
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
          <div className="demo-account-picker">
            <div className="demo-account-heading"><strong>Choose a demo account</strong><span>Each shows a different learning stage</span></div>
            <div className="demo-account-options" role="group" aria-label="Demo account">
              {mockLearners.map((learner) => (
                <button className={selectedProfileId === learner.id ? "selected" : ""} type="button" key={learner.id} onClick={() => setSelectedProfileId(learner.id)} aria-pressed={selectedProfileId === learner.id}>
                  <strong>{learner.accountType === "all-clear" ? "All clear" : learner.accountType[0].toUpperCase() + learner.accountType.slice(1)}</strong>
                  <span>{learner.name}</span>
                </button>
              ))}
            </div>
          </div>
          <form onSubmit={submit}>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" value={selectedProfile.email} readOnly autoComplete="email" required />
            <div className="label-row"><label htmlFor="password">Password</label><button type="button" className="text-button">Forgot password?</button></div>
            <input id="password" name="password" type="password" placeholder="••••••••" autoComplete="current-password" required />
            <label className="remember"><input type="checkbox" /> <span>Remember me</span></label>
            <button className="primary-button login-submit" type="submit" disabled={submitting}>{submitting ? "Opening demo…" : "Log in"}</button>
          </form>
          <div className="divider"><span>Or continue with</span></div>
          <button className="provider-button" type="button"><span className="google-g">G</span> Google</button>
          <button className="provider-button" type="button"><span aria-hidden="true">▥</span> Institutional Sign In</button>
        </div>
        <p className="signup-copy">Don&apos;t have an account? <Link className="text-button" href="/create-account">Create an account</Link></p>
      </section>
    </main>
  );
}
