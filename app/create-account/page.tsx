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
        <Card className="login-card">
          <form onSubmit={submit}>
            {isLocal ? <>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" name="name" type="text" placeholder="Your name" autoComplete="name" required />
              <Label className="auth-spaced-label" htmlFor="signup-email">Email</Label>
              <Input id="signup-email" name="email" type="email" placeholder="name@example.com" autoComplete="email" required />
            </> : <>
              <Label htmlFor="invitation-token">Invitation token</Label>
              <Input id="invitation-token" name="token" type="text" placeholder="Paste your invitation token" autoComplete="off" required />
            </>}
            {!isLocal && <>
              <Label className="auth-spaced-label" htmlFor="signup-password">Password</Label>
              <Input id="signup-password" name="password" type="password" placeholder="At least 8 characters" autoComplete="new-password" minLength={8} required />
              <Label className="auth-spaced-label" htmlFor="confirmation">Confirm password</Label>
              <Input id="confirmation" name="confirmation" type="password" placeholder="Repeat your password" autoComplete="new-password" minLength={8} required />
              <Label className="remember signup-terms"><Checkbox required /> <span>I agree to the Terms and Privacy Policy</span></Label>
            </>}
            {error && <Alert className="auth-error" variant="destructive">{error}</Alert>}
            <Button className="primary-button login-submit" size="lg" type="submit" disabled={submitting}>{submitting ? (isLocal ? "Creating account…" : "Activating account…") : (isLocal ? "Create demo account" : "Activate account")}</Button>
          </form>
        </Card>
        <p className="signup-copy">{isLocal ? "Already have a demo profile?" : "Already activated?"} <Button render={<Link href="/login" />} className="text-button" variant="link">Log in</Button></p>
      </section>
    </main>
  );
}
