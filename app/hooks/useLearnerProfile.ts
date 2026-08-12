"use client";

import { useCallback, useEffect, useState } from "react";
import { api, setDemoUserId, type ApiDashboard, type ApiNotification } from "../lib/api";
import { beginnerLearner, cloneMockLearner, getMockLearner, mockLearners, type DemoLearner } from "../lib/mock-profile";
import { clearActiveCourse } from "../lib/courses";

const eventName = "aivirteach:learner-profile";
let cachedLearnerProfile: DemoLearner | null = null;

function profileTemplate(userId: string) {
  const isSeeded = mockLearners.some((learner) => learner.id === userId);
  return cloneMockLearner(isSeeded ? getMockLearner(userId) : beginnerLearner);
}

function formatActivityTime(value: string) {
  return new Date(value).toLocaleString("en-MY", { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

function mapBackendProfile(data: ApiDashboard, notifications: ApiNotification[]): DemoLearner {
  const fallback = profileTemplate(data.learner.id);
  const learner = data.learner;
  const accountType = learner.id === "learner_beginner" ? "beginner" : learner.id === "learner_all_clear" ? "all-clear" : learner.id === "learner_advanced" ? "advanced" : "beginner";
  const activeCourse = data.activeCourse;

  return {
    ...fallback,
    id: learner.id,
    accountType,
    name: learner.name,
    email: learner.email,
    role: learner.role,
    plan: learner.plan,
    level: learner.level,
    timezone: learner.timezone,
    joinedAt: learner.joinedAt,
    stats: {
      ...fallback.stats,
      streakDays: data.progress.streakDays,
      practiceMinutes: data.progress.totalPracticeMinutes,
      last30PracticeMinutes: data.progress.totalPracticeMinutes,
      tasksCompleted: data.progress.tasksCompleted,
      last30TasksCompleted: data.progress.tasksCompleted,
      skillsMastered: data.progress.skillsMastered,
    },
    course: activeCourse ? {
      category: activeCourse.category,
      title: activeCourse.title,
      module: activeCourse.enrollment.currentModule,
      progress: activeCourse.enrollment.progressPercent,
    } : fallback.course,
    weeklyHours: data.progress.weeklyHours,
    recentActivity: data.recentActivity.map((activity) => ({ ...activity, occurredAt: formatActivityTime(activity.occurredAt) })),
    notifications: notifications.map((notification) => notification.message),
  };
}

export function useLearnerProfile() {
  const [profile, setProfile] = useState<DemoLearner>(() => cachedLearnerProfile ?? profileTemplate("learner_advanced"));
  const [loading, setLoading] = useState(() => cachedLearnerProfile === null);
  const [error, setError] = useState<string | null>(null);

  const publish = useCallback((next: DemoLearner) => {
    cachedLearnerProfile = next;
    setProfile(next);
    window.dispatchEvent(new CustomEvent(eventName, { detail: next }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [dashboard, notifications] = await Promise.all([api.dashboard(), api.notifications()]);
      publish(mapBackendProfile(dashboard, notifications));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cannot reach the AIVirTeach backend");
    } finally {
      setLoading(false);
    }
  }, [publish]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => void refresh(), 0);
    function sync(event: Event) {
      setProfile((event as CustomEvent<DemoLearner>).detail);
    }
    window.addEventListener(eventName, sync);
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener(eventName, sync);
    };
  }, [refresh]);

  const selectDemoProfile = useCallback(async (profileId: string) => {
    setDemoUserId(profileId);
    publish(profileTemplate(profileId));
    setLoading(true);
    await refresh();
  }, [publish, refresh]);

  const updateIdentity = useCallback(async (name: string, role: string) => {
    await api.updateProfile({ name, role });
    await refresh();
  }, [refresh]);

  const createAccount = useCallback(async (name: string, email: string) => {
    const learner = await api.createDemoUser({ name, email });
    setDemoUserId(learner.id);
    clearActiveCourse();
    await refresh();
  }, [refresh]);

  const recordPractice = useCallback(async (minutes = 15) => {
    await api.recordPractice(minutes);
    await refresh();
  }, [refresh]);

  const completeWorkspaceTask = useCallback(async () => {
    await api.completeLesson("dataframe-filtering");
    await refresh();
  }, [refresh]);

  const resetProfile = useCallback(async () => {
    await api.resetProfile();
    await refresh();
  }, [refresh]);

  const markNotificationsRead = useCallback(async () => {
    await api.markAllNotificationsRead();
    await refresh();
  }, [refresh]);

  return { profile, loading, error, refresh, updateIdentity, createAccount, selectDemoProfile, recordPractice, completeWorkspaceTask, resetProfile, markNotificationsRead };
}
