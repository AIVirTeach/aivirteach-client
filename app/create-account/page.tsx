"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "../components/BrandLogo";
import { ThemeToggle } from "../components/ThemeToggle";
import { api, setDemoUserId } from "../lib/api";
import { backendConfig } from "../lib/config";

export default function CreateAccountPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const isLocal = backendConfig.mode === "local";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (password !== confirmation) {
      setError("The passwords do not match. Please try again.");
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
          <h1 id="create-account-title">{isLocal ? "Create a local demo account" : "Activate your learner account"}</h1>
          <p>{isLocal ? "Create a development profile in your local backend." : "Use the one-time invitation token supplied by AIVirTeach."}</p>
        </header>
        <div className="login-card">
          <form onSubmit={submit}>
            {isLocal ? <>
              <label htmlFor="name">Full name</label>
              <input id="name" name="name" type="text" placeholder="Your name" autoComplete="name" required />
              <label className="auth-spaced-label" htmlFor="signup-email">Email</label>
              <input id="signup-email" name="email" type="email" placeholder="name@example.com" autoComplete="email" required />
            </> : <>
              <label htmlFor="invitation-token">Invitation token</label>
              <input id="invitation-token" name="token" type="text" placeholder="Paste your invitation token" autoComplete="off" required />
            </>}
            {!isLocal && <>
              <label className="auth-spaced-label" htmlFor="signup-password">Password</label>
              <input id="signup-password" name="password" type="password" placeholder="At least 8 characters" autoComplete="new-password" minLength={8} required />
              <label className="auth-spaced-label" htmlFor="confirmation">Confirm password</label>
              <input id="confirmation" name="confirmation" type="password" placeholder="Repeat your password" autoComplete="new-password" minLength={8} required />
              <label className="remember signup-terms"><input type="checkbox" required /> <span>I agree to the Terms and Privacy Policy</span></label>
            </>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="primary-button login-submit" type="submit" disabled={submitting}>{submitting ? (isLocal ? "Creating account…" : "Activating account…") : (isLocal ? "Create demo account" : "Activate account")}</button>
          </form>
        </div>
        <p className="signup-copy">{isLocal ? "Already have a demo profile?" : "Already activated?"} <Link className="text-button" href="/login">Log in</Link></p>
      </section>
    </main>
  );
}
