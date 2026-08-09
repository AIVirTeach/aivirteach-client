"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "../components/BrandLogo";
import { ThemeToggle } from "../components/ThemeToggle";
import { useLearnerProfile } from "../hooks/useLearnerProfile";

export default function CreateAccountPage() {
  const router = useRouter();
  const { createAccount } = useLearnerProfile();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
      await createAccount(String(form.get("name") ?? ""), String(form.get("email") ?? ""));
      router.push("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the account.");
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
          <h1 id="create-account-title">Create your learner account</h1>
          <p>Start learning with a personalized demo workspace.</p>
        </header>

        <div className="login-card">
          <form onSubmit={submit}>
            <label htmlFor="name">Full name</label>
            <input id="name" name="name" type="text" placeholder="Your name" autoComplete="name" required />

            <label className="auth-spaced-label" htmlFor="signup-email">Email</label>
            <input id="signup-email" name="email" type="email" placeholder="name@example.com" autoComplete="email" required />

            <label className="auth-spaced-label" htmlFor="signup-password">Password</label>
            <input id="signup-password" name="password" type="password" placeholder="At least 8 characters" autoComplete="new-password" minLength={8} required />

            <label className="auth-spaced-label" htmlFor="confirmation">Confirm password</label>
            <input id="confirmation" name="confirmation" type="password" placeholder="Repeat your password" autoComplete="new-password" minLength={8} required />

            <label className="remember signup-terms"><input type="checkbox" required /> <span>I agree to the Terms and Privacy Policy</span></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="primary-button login-submit" type="submit" disabled={submitting}>{submitting ? "Creating account…" : "Create account"}</button>
          </form>
        </div>

        <p className="signup-copy">Already have an account? <Link className="text-button" href="/login">Log in</Link></p>
      </section>
    </main>
  );
}
