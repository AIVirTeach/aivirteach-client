"use client";

import { useCallback, useEffect, useState } from "react";
import { cloneMockLearner, demoLearner, getMockLearner, type DemoLearner } from "../lib/mock-profile";

const storageKey = "aivirteach.demoLearner.v2";
const eventName = "aivirteach:demo-profile";

function readSavedProfile() {
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) as DemoLearner : null;
  } catch {
    return null;
  }
}

export function useMockProfile() {
  const [profile, setProfile] = useState<DemoLearner>(demoLearner);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = readSavedProfile();
    if (saved) {
      setProfile(saved);
      setLoading(false);
    } else {
      fetch("/api/mock/profile")
        .then((response) => response.json() as Promise<DemoLearner>)
        .then((data) => setProfile(data))
        .catch(() => setProfile(demoLearner))
        .finally(() => setLoading(false));
    }

    function sync(event: Event) {
      setProfile((event as CustomEvent<DemoLearner>).detail);
    }
    window.addEventListener(eventName, sync);
    return () => window.removeEventListener(eventName, sync);
  }, []);

  const commit = useCallback((update: (current: DemoLearner) => DemoLearner) => {
    setProfile((current) => {
      const next = update(current);
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(eventName, { detail: next }));
      void fetch("/api/mock/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      return next;
    });
  }, []);

  const updateIdentity = useCallback((name: string, role: string) => {
    commit((current) => ({ ...current, name: name.trim() || current.name, role: role.trim() || current.role }));
  }, [commit]);

  const createAccount = useCallback((name: string, email: string) => {
    commit((current) => ({
      ...current,
      id: `learner_${Date.now()}`,
      name: name.trim() || "New Learner",
      email: email.trim() || current.email,
      role: "AI Learner",
      accountType: "beginner",
      plan: "Free",
      level: 1,
      joinedAt: new Date().toISOString().slice(0, 10),
      avatar: "",
    }));
  }, [commit]);

  const selectMockProfile = useCallback((profileId: string) => {
    const next = cloneMockLearner(getMockLearner(profileId));
    setProfile(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(eventName, { detail: next }));
  }, []);

  const recordPractice = useCallback((minutes = 15) => {
    commit((current) => ({
      ...current,
      stats: {
        ...current.stats,
        practiceMinutes: current.stats.practiceMinutes + minutes,
        last30PracticeMinutes: current.stats.last30PracticeMinutes + minutes,
        weeklyGoalPercent: Math.min(100, current.stats.weeklyGoalPercent + Math.max(1, Math.round(minutes / 10))),
      },
      weeklyHours: current.weeklyHours.map((hours, index) => index === current.weeklyHours.length - 1 ? Math.round((hours + minutes / 60) * 10) / 10 : hours),
      recentActivity: [{ id: `activity_${Date.now()}`, title: "Learning workspace opened", detail: `${minutes} minute session started`, occurredAt: "Just now", kind: "practice" }, ...current.recentActivity].slice(0, 5),
    }));
  }, [commit]);

  const completeWorkspaceTask = useCallback(() => {
    commit((current) => ({
      ...current,
      stats: { ...current.stats, tasksCompleted: current.stats.tasksCompleted + 1, last30TasksCompleted: current.stats.last30TasksCompleted + 1 },
      course: { ...current.course, progress: Math.min(100, current.course.progress + 3) },
      recentActivity: [{ id: `activity_${Date.now()}`, title: "DataFrame filtering task", detail: "Completed with AI tutor guidance", occurredAt: "Just now", kind: "lesson" }, ...current.recentActivity].slice(0, 5),
    }));
  }, [commit]);

  const resetProfile = useCallback(() => {
    setProfile((current) => {
      const next = cloneMockLearner(getMockLearner(current.id));
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(eventName, { detail: next }));
      return next;
    });
  }, []);

  return { profile, loading, updateIdentity, createAccount, selectMockProfile, recordPractice, completeWorkspaceTask, resetProfile };
}
