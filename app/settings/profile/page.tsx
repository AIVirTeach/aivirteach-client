"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "../../components/Avatar";
import { Sidebar } from "../../components/Sidebar";
import { useLearnerProfile } from "../../hooks/useLearnerProfile";
import { api } from "../../lib/api";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { profile, updateIdentity, resetProfile } = useLearnerProfile();
  const [status, setStatus] = useState("");
  // Mock learners store `joinedAt` as a bare date ("2026-05-18"); the real
  // backend sends a full ISO timestamp (`user.createdAt.toISOString()`).
  // Appending "T00:00:00" to the latter breaks Date parsing, so only do it
  // for the bare-date shape.
  const joinedAtDate = new Date(profile.joinedAt.includes("T") ? profile.joinedAt : `${profile.joinedAt}T00:00:00`);
  const memberSince = joinedAtDate.toLocaleDateString("en-MY", { month: "long", year: "numeric" });

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await updateIdentity(String(form.get("name") ?? ""), String(form.get("role") ?? ""));
      setStatus("Profile saved.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Profile could not be saved.");
    }
  }

  async function resetDemoProfile() {
    try {
      await resetProfile();
      setStatus("Demo profile reset.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Profile could not be reset.");
    }
  }

  return (
    <div className="app-shell">
      <Sidebar active="settings" />
      <main className="profile-settings-page page-content">
        <header className="profile-settings-head">
          <Button render={<Link href="/settings" />} variant="link">← Settings</Button>
          <p className="eyebrow">ACCOUNT</p>
          <h1>Your profile</h1>
          <p>Manage the learner identity used throughout your demo experience.</p>
        </header>

        <Card as="section" className="profile-settings-card">
          <div className="profile-settings-summary">
            <Avatar size="large" name={profile.name} src={profile.avatar} />
            <div><h2>{profile.name}</h2><p>{profile.plan} Learner · Level {profile.level}</p><small>{profile.email}</small></div>
          </div>

          <div className="profile-settings-facts">
            <span><small>Member since</small><strong>{memberSince}</strong></span>
            <span><small>Timezone</small><strong>Kuala Lumpur</strong></span>
          </div>

          <form key={`${profile.name}-${profile.role}`} onSubmit={saveProfile}>
            <Label>Name<Input name="name" defaultValue={profile.name} autoComplete="name" /></Label>
            <Label>Email<Input value={profile.email} readOnly /></Label>
            <Label>Learning focus<Input name="role" defaultValue={profile.role} /></Label>
            <div className="profile-form-actions">
              <Button className="primary-button" size="lg" type="submit">Save profile</Button>
              <Button className="profile-reset-button" variant="destructive" size="lg" type="button" onClick={resetDemoProfile}>Reset demo data</Button>
              <Button className="profile-logout-button" variant="destructive" size="lg" type="button" onClick={() => void api.logout().finally(() => router.replace("/login"))}>Log out</Button>
            </div>
            {status && <p className="profile-save-status" role="status">{status}</p>}
          </form>
        </Card>
      </main>
    </div>
  );
}
