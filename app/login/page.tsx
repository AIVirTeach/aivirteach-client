"use client";

import { FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push("/dashboard");
  }

  return (
    <main className="login-page">
      <div className="login-glow login-glow-one" />
      <div className="login-glow login-glow-two" />
      <section className="login-wrap" aria-labelledby="login-title">
        <header className="login-intro">
          <div className="wordmark"><span className="wordmark-icon">◇</span><h1 id="login-title">Cognitive Flow</h1></div>
          <h2>Learn by doing, with AI beside you.</h2>
          <p>Practise skills in an interactive workspace with personalised AI guidance.</p>
        </header>
        <div className="login-card">
          <form onSubmit={submit}>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" placeholder="name@example.com" autoComplete="email" required />
            <div className="label-row"><label htmlFor="password">Password</label><button type="button" className="text-button">Forgot password?</button></div>
            <input id="password" name="password" type="password" placeholder="••••••••" autoComplete="current-password" required />
            <label className="remember"><input type="checkbox" /> <span>Remember me</span></label>
            <button className="primary-button login-submit" type="submit">Log in</button>
          </form>
          <div className="divider"><span>Or continue with</span></div>
          <button className="provider-button" type="button"><span className="google-g">G</span> Google</button>
          <button className="provider-button" type="button"><span aria-hidden="true">▥</span> Institutional Sign In</button>
        </div>
        <p className="signup-copy">Don&apos;t have an account? <button type="button" className="text-button">Create an account</button></p>
      </section>
    </main>
  );
}
