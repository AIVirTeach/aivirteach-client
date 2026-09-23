import { API_BASE_URL, backendConfig } from "./config";

const demoUserStorageKey = "aivirteach.demoUserId.v1";
const authStorageKey = "aivirteach.auth.v1";

export type AuthUser = { userId: string; email: string };
export type AuthSession = { accessToken: string; refreshToken: string; expiresAt: number };
type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number };

function readSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(authStorageKey) ?? window.localStorage.getItem(authStorageKey);
  if (!value) return null;
  try {
    return JSON.parse(value) as AuthSession;
  } catch {
    window.sessionStorage.removeItem(authStorageKey);
    window.localStorage.removeItem(authStorageKey);
    return null;
  }
}

function saveSession(tokens: TokenPair, persistent?: boolean) {
  const currentPersistent = window.localStorage.getItem(authStorageKey) !== null;
  const storage = (persistent ?? currentPersistent) ? window.localStorage : window.sessionStorage;
  const otherStorage = storage === window.localStorage ? window.sessionStorage : window.localStorage;
  const session: AuthSession = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };
  otherStorage.removeItem(authStorageKey);
  storage.setItem(authStorageKey, JSON.stringify(session));
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(authStorageKey);
  window.localStorage.removeItem(authStorageKey);
}

export function hasAuthSession() {
  return backendConfig.mode === "local" || readSession() !== null;
}

export function getAccessToken(): string | null {
  return readSession()?.accessToken ?? null;
}

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

async function responseError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string; message?: string | string[] } | null;
  const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
  return new ApiError(response.status, message ?? body?.error ?? "Backend request failed");
}

async function publicRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) throw await responseError(response);
  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}

let refreshPromise: Promise<AuthSession> | null = null;

async function refreshSession() {
  refreshPromise ??= (async () => {
    const current = readSession();
    if (!current) throw new ApiError(401, "Please log in to continue.");
    try {
      const tokens = await publicRequest<TokenPair>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      saveSession(tokens);
      return readSession()!;
    } catch (error) {
      clearAuthSession();
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// request() 和 streamRequest() 共享的部分：读 session、临过期时主动刷新、拼 header、
// 401 时刷新重试一次。两者只在"怎么处理最终 Response"上分叉（转 JSON vs 原样返回给
// 调用方去读 event-stream body），所以提成一个辅助函数，不能各自维护一份、容易漏改。
async function authorizedFetch(
  path: string,
  init: RequestInit,
  extraHeaders: Record<string, string>,
  retry = true,
): Promise<Response> {
  let session = backendConfig.mode === "remote" ? readSession() : null;
  if (backendConfig.mode === "remote" && !session) throw new ApiError(401, "Please log in to continue.");
  if (session && session.expiresAt <= Date.now() + 15_000) session = await refreshSession();

  const response = await fetch(API_BASE_URL + path, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      "X-Demo-User-Id": getDemoUserId(),
      ...extraHeaders,
      ...init.headers,
    },
  });

  if (backendConfig.mode === "remote" && response.status === 401 && retry) {
    await refreshSession();
    return authorizedFetch(path, init, extraHeaders, false);
  }
  return response;
}

// SSE 端点：调用方需要拿到原始 Response 去读 .body（ReadableStream），不能走 request()——
// 那边固定 response.json()，会把 event-stream 当 JSON 解析炸掉。
async function streamRequest(path: string, init?: RequestInit): Promise<Response> {
  const response = await authorizedFetch(path, init ?? {}, { Accept: "text/event-stream" });
  if (!response.ok) throw await responseError(response);
  return response;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authorizedFetch(path, init ?? {}, {});
  if (!response.ok) throw await responseError(response);
  if (response.status === 204) return undefined as T;

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
  overviewAssetId?: string;
  overviewAsset: { id: string; alt: string } | null;
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

export type ApiWorkspace = {
  id: string;
  enrollmentId: string;
  status: "CREATING" | "RUNNING" | "STOPPED" | "ERROR" | "RESETTING" | "DESTROYED";
  errorMessage: string | null;
};

export type ApiConsoleSession = {
  labId: string;
  state: string;
  data?: string;
  expiresAt?: string;
};

export type ApiGuacamoleToken = {
  authToken: string;
  websocketUrl: string;
};

export type ApiHealth = {
  status: string;
  database: "up" | "down";
};

export const api = {
  health: () => publicRequest<ApiHealth>("/health"),
  login: async (email: string, password: string, persistent = false) => {
    if (backendConfig.mode === "local") {
      const localUsers: Record<string, string> = {
        "maya.beginner@example.edu": "learner_beginner",
        "alex.chen@example.edu": "learner_advanced",
        "jordan.complete@example.edu": "learner_all_clear",
      };
      setDemoUserId(localUsers[email.toLowerCase()] ?? "learner_advanced");
      const learner = await request<ApiLearner>("/me");
      return { userId: learner.id, email: learner.email };
    }
    const tokens = await publicRequest<TokenPair>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    saveSession(tokens, persistent);
    return request<AuthUser>("/auth/me");
  },
  acceptInvitation: async (token: string, password: string, persistent = true) => {
    const tokens = await publicRequest<TokenPair>("/auth/invitations/accept", { method: "POST", body: JSON.stringify({ token, password }) });
    saveSession(tokens, persistent);
    return request<AuthUser>("/auth/me");
  },
  me: async () => {
    if (backendConfig.mode === "local") {
      const learner = await request<ApiLearner>("/me");
      return { userId: learner.id, email: learner.email };
    }
    return request<AuthUser>("/auth/me");
  },
  logout: async () => {
    if (backendConfig.mode === "local") {
      clearAuthSession();
      return;
    }
    const session = readSession();
    try {
      if (session) await publicRequest<void>("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: session.refreshToken }) });
    } finally {
      clearAuthSession();
    }
  },
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
  chatMessages: (enrollmentId: string) => request<ApiChatMessage[]>("/workspaces/" + encodeURIComponent(enrollmentId) + "/chat/messages"),
  sendChatMessage: (enrollmentId: string, text: string) => request<{ studentMessage: ApiChatMessage; tutorMessage: ApiChatMessage }>("/workspaces/" + encodeURIComponent(enrollmentId) + "/chat/messages", { method: "POST", body: JSON.stringify({ text }) }),
  streamChatMessage: (enrollmentId: string, text: string, signal?: AbortSignal) => streamRequest("/workspaces/" + encodeURIComponent(enrollmentId) + "/chat/messages/stream", { method: "POST", body: JSON.stringify({ text }), signal }),
  workspace: (enrollmentId: string) => request<ApiWorkspace>("/workspaces/" + encodeURIComponent(enrollmentId)),
  createWorkspace: (enrollmentId: string) => request<ApiWorkspace>("/workspaces", { method: "POST", body: JSON.stringify({ enrollmentId }) }),
  consoleSession: (enrollmentId: string) =>
    request<ApiConsoleSession>("/workspaces/" + encodeURIComponent(enrollmentId) + "/console-session", {
      method: "POST",
    }),
  exchangeConsoleToken: (enrollmentId: string, data: string) =>
    request<ApiGuacamoleToken>("/workspaces/" + encodeURIComponent(enrollmentId) + "/console-session/token", {
      method: "POST",
      body: JSON.stringify({ data }),
    }),
  stopWorkspace: (enrollmentId: string) =>
    request<ApiWorkspace>("/workspaces/" + encodeURIComponent(enrollmentId) + "/stop", {
      method: "POST",
      body: JSON.stringify({ reason: "manual" }),
    }),
  startWorkspace: (enrollmentId: string) =>
    request<ApiWorkspace>("/workspaces/" + encodeURIComponent(enrollmentId) + "/start", { method: "POST" }),
  workspaceHeartbeat: (enrollmentId: string) =>
    request<ApiWorkspace>("/workspaces/" + encodeURIComponent(enrollmentId) + "/heartbeat", { method: "POST" }),
};

// 关标签页那一刻用 navigator.sendBeacon 打，不走 fetch——页面正在被卸载，fetch 请求经常来不及
// 发出去就被浏览器砍掉。sendBeacon 不能带自定义请求头，所以 token 放 query string（服务端
// JwtAuthGuard 会在没有 Authorization 头时回退读这个），reason 放 body。
export function beaconStopWorkspace(enrollmentId: string, token: string | null): void {
  if (!token) return;
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;

  const url = `${API_BASE_URL}/workspaces/${encodeURIComponent(enrollmentId)}/stop?token=${encodeURIComponent(token)}`;
  const body = new Blob([JSON.stringify({ reason: "beacon" })], { type: "application/json" });
  navigator.sendBeacon(url, body);
}

export function courseAssetUrl(courseId: string, assetId: string) {
  return `${API_BASE_URL}/courses/${encodeURIComponent(courseId)}/assets/${encodeURIComponent(assetId)}`;
}
