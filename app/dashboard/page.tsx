"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Sidebar } from "../components/Sidebar";
import { useLearnerProfile } from "../hooks/useLearnerProfile";
import { activateCourse, courseCatalog } from "../lib/courses";

export default function DashboardPage() {
  const { profile, loading, error, recordPractice, markNotificationsRead } = useLearnerProfile();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [highlightUnread, setHighlightUnread] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFeedback, setSearchFeedback] = useState("");

  useEffect(() => {
    if (!searchFeedback) return;
    const timer = window.setTimeout(() => setSearchFeedback(""), 5000);
    return () => window.clearTimeout(timer);
  }, [searchFeedback]);

  const firstName = profile.name.split(" ")[0];
  const isAllClear = profile.accountType === "all-clear";
  const currentCatalogCourse = courseCatalog.find((course) => course.title === profile.course.title) ?? (profile.accountType === "beginner" ? courseCatalog[2] : courseCatalog[0]);
  const practiceHours = Math.round(profile.stats.practiceMinutes / 60);
  const stats = [
    { icon: "streak", value: `${profile.stats.streakDays} Days`, label: "Current Streak", tone: "amber" },
    { icon: "practice", value: `${practiceHours}h`, label: "Practice Time", tone: "neutral" },
    { icon: "skills", value: String(profile.stats.skillsMastered), label: "Skills Mastered", tone: "peach" },
  ];

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchFeedback("Enter a course or skill to search.");
      return;
    }

    const searchableItems = [profile.course.title, profile.course.category, profile.course.module, ...profile.skills.map((skill) => skill.name)];
    const match = searchableItems.find((item) => item.toLowerCase().includes(query.toLowerCase()));
    setSearchFeedback(match ? `Found: ${match}` : `No results for “${query}”.`);
  }

  function changeNotifications(open: boolean) {
    if (!open) {
      setNotificationsOpen(false);
      setHighlightUnread(false);
      return;
    }

    setHighlightUnread(!notificationsRead && profile.notifications.length > 0);
    setNotificationsRead(true);
    void markNotificationsRead();
    setNotificationsOpen(true);
  }

  function closeNotifications() {
    setNotificationsOpen(false);
    setHighlightUnread(false);
  }

  return (
    <div className="app-shell dashboard-shell">
      <Sidebar active="dashboard" />
      <main className={`dashboard page-content ${loading ? "data-loading" : ""}`}>
        {error && <Alert className="auth-error" variant="destructive">Backend unavailable: {error}</Alert>}
        <header className="dashboard-toolbar">
          <form className="search-box" role="search" onSubmit={submitSearch}>
            <Input aria-label="Search courses and skills" placeholder="Search..." value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchFeedback(""); }} />
            <Button className="search-button" variant="ghost" size="icon" type="submit" aria-label="Search"><span className="search-glyph" aria-hidden="true" /></Button>
            {searchFeedback && <output className="search-feedback" aria-live="polite">{searchFeedback}</output>}
          </form>
          <div className="notification-wrap">
            <Popover open={notificationsOpen} onOpenChange={changeNotifications}>
              <PopoverTrigger render={<Button className="notification-button" variant="ghost" size="icon" type="button" aria-label={notificationsRead ? "Notifications" : "Notifications, new items"} />}><span className="bell-icon" aria-hidden="true" />{!notificationsRead && <span className="notification-dot" />}</PopoverTrigger>
              <PopoverContent className="notification-popover" align="end" sideOffset={8}><header><PopoverTitle>Notifications</PopoverTitle><Button variant="ghost" size="icon-sm" type="button" onClick={closeNotifications} aria-label="Close notifications">×</Button></header>{profile.notifications.map((notification) => <p className={highlightUnread ? "unread" : ""} key={notification}>{highlightUnread && <Badge className="new-label">New</Badge>}{notification}</p>)}</PopoverContent>
            </Popover>
          </div>
        </header>
        <section className="welcome-copy">
          <h1>{isAllClear ? `Hi, ${firstName}! You're all clear.` : `Hi, ${firstName}! You're making great progress.`}</h1>
          <p>{isAllClear ? "You have completed every available lesson. Keep your skills fresh or explore what is next." : "Pick up where you left off or explore new concepts."}</p>
        </section>
        <section className="dashboard-grid" aria-label="Current learning overview">
          <Card as="article" className="course-card">
            <Badge className="course-chip" variant="secondary">◇ &nbsp; {profile.course.category}</Badge>
            <h2>{profile.course.title}</h2>
            <p>{profile.course.module}</p>
            <div className="course-progress-label"><strong>{profile.course.progress}% Completed</strong></div>
            <Progress className="progress-track" value={profile.course.progress} aria-label={`${profile.course.progress}% completed`} />
          <Button render={<Link href={isAllClear ? "/courses" : "/workspace"} />} className="primary-button resume-button" size="lg" onClick={() => { if (!isAllClear) { activateCourse(currentCatalogCourse.id); void recordPractice(15); } }}>{isAllClear ? "Explore Courses" : "Resume Session"} <span>→</span></Button>
          </Card>
          <div className="stat-stack">
            {stats.map((stat) => <Card as="article" className="stat-card" key={stat.label}><span className={`stat-icon ${stat.tone}`} aria-hidden="true"><i className={`stat-glyph ${stat.icon}`} /></span><div><strong>{stat.value}</strong><span>{stat.label}</span></div></Card>)}
          </div>
        </section>
      </main>
    </div>
  );
}
