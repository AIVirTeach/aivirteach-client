const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");
const demoUserStorageKey = "aivirteach.demoUserId.v1";

export function getDemoUserId() {
  if (typeof window === "undefined") return "learner_advanced";
  return window.localStorage.getItem(demoUserStorageKey) ?? "learner_advanced";
}

export function setDemoUserId(userId: string) {
  window.localStorage.setItem(demoUserStorageKey, userId);
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Demo-User-Id": getDemoUserId(),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
    throw new ApiError(response.status, message ?? "Backend request failed");
  }

  return response.json() as Promise<T>;
}

export type ApiLearner = {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: "Free" | "Premium";
  level: number;
  timezone: string;
  joinedAt: string;
  streakDays: number;
  skillsMastered: number;
  tasksCompleted: number;
};

export type ApiCourse = {
  id: string;
  title: string;
  category: string;
  description: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  durationMinutes: number;
  lessonCount: number;
  published: boolean;
  coverAssetId?: string;
};

export type ApiCourseLessonSummary = {
  id: string;
  position: number;
  title: string;
  estimatedMinutes: number;
  objectives: string[];
  activity: { type: string; prompt: string; completionType: string };
};

export type ApiCourseModule = {
  id: string;
  position: number;
  title: string;
  description: string;
  estimatedMinutes: number;
  lessons: ApiCourseLessonSummary[];
};

export type ApiCourseDetail = ApiCourse & {
  slug: string;
  version: number;
  shortTitle: string;
  language: string;
  tags: string[];
  outcomes: string[];
  requirements: string[];
  modules: ApiCourseModule[];
};

export type ApiLesson = {
  courseId: string;
  module: { id: string; title: string; position: number };
  lesson: ApiCourseLessonSummary;
  markdown: string;
  assessment: null | { id: string; type: string; question: string; options?: string[]; criteria?: string[] };
  navigation: { previousLessonId: string | null; nextLessonId: string | null; index: number; total: number };
};

export type ApiCourseWelcome = {
  schemaVersion: number;
  courseId: string;
  title: string;
  overviewAssetId: string;
  overviewAsset: { id: string; alt: string };
  overview: { heading: string; paragraphs: string[] };
  howItWorks: { heading: string; steps: Array<{ number: string; title: string; description: string }> };
  finalOutcome: { heading: string; description: string };
};

export type ApiEnrollment = {
  id: string;
  userId: string;
  courseId: string;
  active: boolean;
  progressPercent: number;
  currentModule: string;
  enrolledAt: string;
  course: ApiCourse;
};

export type ApiActivity = {
  id: string;
  title: string;
  detail: string;
  kind: "lesson" | "practice" | "achievement";
  occurredAt: string;
};

export type ApiNotification = {
  id: string;
  message: string;
  createdAt: string;
  readAt: string | null;
};

export type ApiProgress = {
  userId: string;
  streakDays: number;
  skillsMastered: number;
  tasksCompleted: number;
  totalPracticeMinutes: number;
  weeklyHours: number[];
};

export type ApiDashboard = {
  learner: ApiLearner;
  activeCourse: (ApiCourse & { enrollment: Omit<ApiEnrollment, "course"> }) | null;
  progress: ApiProgress;
  unreadNotificationCount: number;
  recentActivity: ApiActivity[];
};

export type ApiChatMessage = {
  id: string;
  userId: string;
  threadId: string;
  role: "student" | "tutor";
  text: string;
  createdAt: string;
};

export type ApiHealth = {
  status: string;
  service: string;
  version: string;
  storage: string;
  timestamp: string;
};

export const api = {
  health: () => request<ApiHealth>("/health"),
  dashboard: () => request<ApiDashboard>("/dashboard"),
  notifications: () => request<ApiNotification[]>("/notifications"),
  markAllNotificationsRead: () => request<{ updated: number; readAt: string }>("/notifications/read-all", { method: "POST" }),
  courses: () => request<ApiCourse[]>("/courses"),
  course: (courseId: string) => request<ApiCourseDetail>("/courses/" + encodeURIComponent(courseId)),
  courseWelcome: (courseId: string) => request<ApiCourseWelcome>("/courses/" + encodeURIComponent(courseId) + "/welcome"),
  lesson: (courseId: string, lessonId: string) => request<ApiLesson>("/courses/" + encodeURIComponent(courseId) + "/lessons/" + encodeURIComponent(lessonId)),
  enrollments: () => request<ApiEnrollment[]>("/me/enrollments"),
  enroll: (courseId: string) => request<ApiEnrollment>("/courses/" + encodeURIComponent(courseId) + "/enroll", { method: "POST" }),
  restartCourse: (courseId: string) => request<ApiEnrollment>("/courses/" + encodeURIComponent(courseId) + "/restart", { method: "POST" }),
  submitAssessment: (courseId: string, lessonId: string, answer: unknown) => request<{ correct: boolean; explanation: string }>("/courses/" + encodeURIComponent(courseId) + "/lessons/" + encodeURIComponent(lessonId) + "/assessment", { method: "POST", body: JSON.stringify({ answer }) }),
  updateProfile: (input: { name?: string; role?: string; timezone?: string }) => request<ApiLearner>("/me", { method: "PATCH", body: JSON.stringify(input) }),
  createDemoUser: (input: { name: string; email: string }) => request<ApiLearner>("/demo/users", { method: "POST", body: JSON.stringify(input) }),
  resetProfile: () => request<ApiLearner>("/me/reset", { method: "POST" }),
  recordPractice: (minutes: number) => request("/practice-sessions", { method: "POST", body: JSON.stringify({ minutes }) }),
  completeLesson: (lessonId: string) => request("/lessons/" + encodeURIComponent(lessonId) + "/complete", { method: "POST" }),
  chatMessages: (threadId: string) => request<ApiChatMessage[]>("/chat/threads/" + encodeURIComponent(threadId) + "/messages"),
  sendChatMessage: (threadId: string, text: string) => request<{ studentMessage: ApiChatMessage; tutorMessage: ApiChatMessage }>("/chat/threads/" + encodeURIComponent(threadId) + "/messages", { method: "POST", body: JSON.stringify({ text }) }),
};

export function courseAssetUrl(courseId: string, assetId: string) {
  return `${API_BASE_URL}/courses/${encodeURIComponent(courseId)}/assets/${encodeURIComponent(assetId)}`;
}
