"use client";

import { useRouter } from "next/navigation";
import { type ComponentPropsWithoutRef, type CSSProperties, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { Markdown } from "@tanstack/markdown/react";
import { streamingMarkdownExtension } from "@tanstack/markdown/extensions/streaming";
import { AccountMenu } from "../components/AccountMenu";
import { BrandLogo } from "../components/BrandLogo";
import { CourseLessonContent } from "../components/CourseLessonContent";
import { Sidebar } from "../components/Sidebar";
import { api, ApiError, beaconStopWorkspace, getAccessToken, type ApiConsoleSession, type ApiCourseDetail, type ApiEnrollment, type ApiLesson, type ApiWorkspace } from "../lib/api";
import { parseSseStream } from "../lib/sse";
import { subscribeWorkspace } from "../lib/ws";
import { ConsoleViewer } from "./console-viewer";
import { progressLabel } from "./chat-progress";
import { heartbeatIntervalMs, isHeartbeatDue } from "./heartbeat";
import { parseChatStreamFrame } from "./chat-stream-frame";
import { isSafeMarkdownHref } from "./markdown-safety";
import { typewriterChunks, typewriterDelayMs } from "./typewriter";
import { upstreamErrorMessage, type UpstreamErrorMessages } from "./upstream-error";

type Message = { role: "tutor" | "student"; text: string };

const initialMessages: Message[] = [
  { role: "tutor", text: "I am ready to help with this course step. Tell me what you are trying to do or where the result differs from the lesson." },
];

// 面向学生的文案，按"重试是否有用"分两档，不透出任何上游响应内容或内部服务名——
// 跟 aivirteach-server 的 VM_MESSAGES/REMOTE_DESKTOP_MESSAGES/AGENT_MESSAGES 保持同一套文案，
// 不管这次报错是服务端已经分档好再传下来的，还是本地按 ApiError.status 现分档的，学生看到的都一样。
const VM_MESSAGES: UpstreamErrorMessages = {
  retryable: "学习环境暂时连接不上，请稍后重试。",
  unavailable: "学习环境暂时无法使用，请稍后再试或联系客服。",
};
const REMOTE_DESKTOP_MESSAGES: UpstreamErrorMessages = {
  retryable: "远程桌面连接失败，请稍后重试。",
  unavailable: "远程桌面暂时无法使用，请联系客服。",
};
const AGENT_MESSAGES: UpstreamErrorMessages = {
  retryable: "助教暂时没有回应，请重试一次。",
  unavailable: "助教服务暂时不可用，请联系客服。",
};

const markdownExtensions = [streamingMarkdownExtension()];

function SafeAnchor({ href, children, ...rest }: ComponentPropsWithoutRef<"a">) {
  return <a {...rest} href={isSafeMarkdownHref(href) ? href : undefined}>{children}</a>;
}
const markdownComponents = { a: SafeAnchor };

const courseRailWidthStorageKey = "aivirteach.lab.courseRailWidth.v1";
const minCourseRailWidth = 320;
const maxCourseRailWidth = 620;
const workspacePollIntervalMs = 10000;

function formatElapsed(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export default function WorkspacePage() {
  const router = useRouter();
  const [course, setCourse] = useState<ApiCourseDetail | null>(null);
  const [enrollment, setEnrollment] = useState<ApiEnrollment | null>(null);
  const [workspace, setWorkspace] = useState<ApiWorkspace | null>(null);
  const [lesson, setLesson] = useState<ApiLesson | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [courseChecked, setCourseChecked] = useState(false);
  const [contentError, setContentError] = useState("");
  const [lessonLoading, setLessonLoading] = useState(false);
  const [completionStatus, setCompletionStatus] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [streaming, setStreaming] = useState(false);
  const [streamingProgress, setStreamingProgress] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [courseSummaryCollapsed, setCourseSummaryCollapsed] = useState(false);
  const [tutorCollapsed, setTutorCollapsed] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [courseRailWidth, setCourseRailWidth] = useState(420);
  const [vmEnvOpen, setVmEnvOpen] = useState(false);
  const [consoleSession, setConsoleSession] = useState<ApiConsoleSession | null>(null);
  const [consoleError, setConsoleError] = useState("");
  const [consoleLoading, setConsoleLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [resuming, setResuming] = useState(false);
  const consolePollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consolePollCancelled = useRef(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vmEnvCloseButtonRef = useRef<HTMLButtonElement>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  // 组件卸载时中止还在飞的聊天流：sendMessage 是表单回调不是 effect，没有天然的
  // cleanup 时机，靠这个 mount-only effect 补上，避免卸载后还在读流、还在 setState。
  useEffect(() => () => chatAbortRef.current?.abort(), []);

  useEffect(() => {
    let active = true;
    api.enrollments().then(async (enrollments) => {
      const activeEnrollment = enrollments.find((item) => item.active);
      if (!activeEnrollment) return;
      const courseData = await api.course(activeEnrollment.courseId);
      if (!active) return;
      const lessons = courseData.modules.flatMap((module) => module.lessons);
      const storedLessonId = window.localStorage.getItem(`aivirteach.course.lesson.${courseData.id}`);
      const completedSteps = Math.floor((activeEnrollment.progressPercent / 100) * lessons.length);
      const fallbackLesson = lessons[Math.min(completedSteps, lessons.length - 1)] ?? lessons[0];
      const initialLesson = lessons.find((item) => item.id === storedLessonId) ?? fallbackLesson;
      setEnrollment(activeEnrollment);
      setCourse(courseData);
      setSelectedLessonId(initialLesson?.id ?? null);
    }).catch(() => {
      if (active) setContentError("Could not load the course.");
    }).finally(() => { if (active) setCourseChecked(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!enrollment) return;
    let active = true;
    let unsubscribe: (() => void) | null = null;

    async function ensureWorkspace() {
      let current: ApiWorkspace;
      try {
        current = await api.workspace(enrollment!.id);
      } catch (caught) {
        if (!(caught instanceof ApiError) || caught.status !== 404) throw caught;
        current = await api.createWorkspace(enrollment!.id);
      }
      if (!active) return;
      setWorkspace(current);
      unsubscribe = subscribeWorkspace(enrollment!.id, (updated) => { if (active) setWorkspace(updated); });
    }

    ensureWorkspace().catch((caught) => {
      if (active) setContentError(upstreamErrorMessage(caught, VM_MESSAGES));
    });

    return () => { active = false; unsubscribe?.(); };
  }, [enrollment]);

  // WS 推送在服务端 waitUntil 后台任务被 Vercel 回收时不会产生任何广播（DB 也不会
  // 更新），重连 WS 接不到一条不存在的消息——这种情况下只有客户端主动重新 GET 才能
  // 触发服务端 getForEnrollment 里"createdAt 超过 5 分钟即判超时"的兜底。轮询作为
  // 兜底而非替代：一旦状态变为终态就自动停止，不影响 WS 推送到达时的即时更新。
  useEffect(() => {
    if (!enrollment || workspace?.status !== "CREATING") return;
    let active = true;
    const interval = window.setInterval(() => {
      api.workspace(enrollment.id).then((updated) => { if (active) setWorkspace(updated); }).catch(() => undefined);
    }, workspacePollIntervalMs);
    return () => { active = false; window.clearInterval(interval); };
  }, [enrollment, workspace?.status]);

  // Plan A（主路径）：关标签页时用 sendBeacon 立即通知服务端停止 VM，不等心跳超时。
  // Plan B（兜底）：每 60 秒发一次心跳，只在页面可见且有焦点时发；如果心跳断了
  // （崩溃、断网、beacon 没送到），服务端会在空闲超过阈值后自己收掉，见 workspace 服务端设计。
  useEffect(() => {
    if (!enrollment || workspace?.status !== "RUNNING") return;
    const enrollmentId = enrollment.id;

    const interval = window.setInterval(() => {
      if (!isHeartbeatDue(workspace?.status, document.visibilityState === "visible", document.hasFocus())) return;
      void api.workspaceHeartbeat(enrollmentId).catch(() => undefined);
    }, heartbeatIntervalMs);

    function stopOnClose() {
      beaconStopWorkspace(enrollmentId, getAccessToken());
    }
    window.addEventListener("pagehide", stopOnClose);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", stopOnClose);
    };
  }, [enrollment, workspace?.status]);

  useEffect(() => {
    if (workspace?.status !== "RUNNING") {
      consolePollCancelled.current = true;
      setConsoleSession(null);
      setConsoleError("");
      setConsoleLoading(false);
      if (consolePollTimer.current) {
        clearTimeout(consolePollTimer.current);
        consolePollTimer.current = null;
      }
    }
  }, [workspace?.status]);

  useEffect(() => {
    if (!vmEnvOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    vmEnvCloseButtonRef.current?.focus();
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setVmEnvOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [vmEnvOpen]);

  useEffect(() => {
    if (!course || !selectedLessonId) return;
    let active = true;
    setLessonLoading(true);
    setCompletionStatus("");
    api.lesson(course.id, selectedLessonId).then((lessonData) => {
      if (!active) return;
      setLesson(lessonData);
      window.localStorage.setItem(`aivirteach.course.lesson.${course.id}`, selectedLessonId);
    }).catch(() => {
      if (active) setContentError("Could not load this step.");
    }).finally(() => { if (active) setLessonLoading(false); });
    return () => { active = false; };
  }, [course, selectedLessonId]);

  useEffect(() => {
    if (!enrollment) return;
    api.chatMessages(enrollment.id).then((items) => {
      if (items.length) setMessages(items.map((item) => ({ role: item.role, text: item.text })));
    }).catch(() => undefined);
  }, [enrollment]);

  useEffect(() => {
    if (!course) return;
    const storageKey = `aivirteach.lab.activeSeconds.${course.id}`;
    const savedSeconds = Number(window.localStorage.getItem(storageKey));
    if (Number.isFinite(savedSeconds) && savedSeconds > 0) setElapsedSeconds(savedSeconds);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      setElapsedSeconds((current) => {
        const next = current + 1;
        window.localStorage.setItem(storageKey, String(next));
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [course]);

  useEffect(() => {
    let active = true;
    async function measureLatency() {
      const startedAt = performance.now();
      try {
        await api.health();
        if (active) setLatency(Math.max(1, Math.round(performance.now() - startedAt)));
      } catch { if (active) setLatency(null); }
    }
    void measureLatency();
    const interval = window.setInterval(() => void measureLatency(), 15000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);

  useEffect(() => () => {
    consolePollCancelled.current = true;
    if (consolePollTimer.current) clearTimeout(consolePollTimer.current);
  }, []);

  useEffect(() => {
    const savedWidth = Number(window.localStorage.getItem(courseRailWidthStorageKey));
    if (Number.isFinite(savedWidth)) setCourseRailWidth(Math.min(maxCourseRailWidth, Math.max(minCourseRailWidth, savedWidth)));
  }, []);

  function selectLesson(lessonId: string | null) {
    if (lessonId) setSelectedLessonId(lessonId);
  }

  function startCourseRailResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (courseSummaryCollapsed || event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = courseRailWidth;
    let nextWidth = courseRailWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function resize(moveEvent: PointerEvent) {
      nextWidth = Math.min(maxCourseRailWidth, Math.max(minCourseRailWidth, startWidth + moveEvent.clientX - startX));
      setCourseRailWidth(nextWidth);
    }
    function stopResize() {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stopResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.localStorage.setItem(courseRailWidthStorageKey, String(nextWidth));
    }
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stopResize);
  }

  function resizeCourseRailWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    setCourseRailWidth((current) => {
      const next = Math.min(maxCourseRailWidth, Math.max(minCourseRailWidth, current + direction * 20));
      window.localStorage.setItem(courseRailWidthStorageKey, String(next));
      return next;
    });
  }

  async function completeStep() {
    if (!lesson) return;
    setCompletionStatus("Saving...");
    try {
      const result = await api.completeLesson(lesson.lesson.id) as { enrollment: ApiEnrollment };
      setEnrollment((current) => current ? { ...current, ...result.enrollment } : current);
      setCompletionStatus("Step completed");
      if (lesson.navigation.nextLessonId) selectLesson(lesson.navigation.nextLessonId);
    } catch {
      setCompletionStatus("Could not complete this step.");
    }
  }

  async function revealTutorText(text: string, signal: AbortSignal) {
    let accumulated = "";
    for (const chunk of typewriterChunks(text)) {
      if (signal.aborted) return;
      accumulated += chunk;
      setStreamingText(accumulated);
      await new Promise((resolve) => setTimeout(resolve, typewriterDelayMs()));
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment || streaming) return;
    const text = message.trim();
    if (!text) return;
    setMessage("");
    setMessages((current) => [...current, { role: "student", text }]);
    setStreaming(true);
    setStreamingProgress(null);
    setStreamingText("");
    const controller = new AbortController();
    chatAbortRef.current = controller;
    try {
      const response = await api.streamChatMessage(enrollment.id, text, controller.signal);
      if (!response.body) throw new Error("The tutor is unavailable.");

      let tutorText: string | null = null;
      for await (const frame of parseSseStream(response.body)) {
        const parsed = parseChatStreamFrame(frame.data);
        if (!parsed) continue;
        if (parsed.type === "progress") {
          const label = progressLabel(parsed.event, parsed.data);
          if (label) setStreamingProgress(label);
        } else {
          tutorText = parsed.tutorMessage.text;
        }
      }

      if (tutorText === null) throw new Error("The tutor is unavailable.");
      await revealTutorText(tutorText, controller.signal);
      if (controller.signal.aborted) return;
      setMessages((current) => [...current, { role: "tutor", text: tutorText! }]);
    } catch (caught) {
      // 上面两处 throw new Error(...) 不是 ApiError，upstreamErrorMessage 会把它们归为
      // retryable（提示重试）而不是 unavailable——这是有意为之：响应体缺失/流结束却没有最终
      // 消息通常是瞬时的网络或流式问题，值得让用户重试，不该直接判定为服务不可用。
      if (controller.signal.aborted) return;
      setMessages((current) => [...current, { role: "tutor", text: upstreamErrorMessage(caught, AGENT_MESSAGES) }]);
    } finally {
      if (!controller.signal.aborted) {
        setStreaming(false);
        setStreamingProgress(null);
        setStreamingText("");
      }
    }
  }

  function retryWorkspace() {
    if (!enrollment || retrying) return;
    setRetrying(true);
    void api.createWorkspace(enrollment.id).then(setWorkspace).catch((caught) => {
      setContentError(upstreamErrorMessage(caught, VM_MESSAGES));
    }).finally(() => setRetrying(false));
  }

  function closeEnvironment() {
    if (!enrollment || stopping) return;
    if (!window.confirm("Close the learning environment? You can resume it anytime.")) return;
    setStopping(true);
    void api.stopWorkspace(enrollment.id).then(setWorkspace).catch((caught) => {
      setContentError(upstreamErrorMessage(caught, VM_MESSAGES));
    }).finally(() => setStopping(false));
  }

  function resumeWorkspace() {
    if (!enrollment || resuming) return;
    setResuming(true);
    void api.startWorkspace(enrollment.id).then(setWorkspace).catch((caught) => {
      setContentError(upstreamErrorMessage(caught, VM_MESSAGES));
    }).finally(() => setResuming(false));
  }

  const consolePollDeadlineMs = 2 * 60 * 1000;
  const consolePollIntervalMs = 2500;

  async function startConsoleSession() {
    if (!enrollment) return;
    // 上一轮轮询可能因为超时/报错而结束但定时器已经清空、也可能是用户重新点击重试——
    // 无论哪种情况，开始新一轮之前先把旧状态清干净，保证同一时刻只有一条轮询链在跑。
    if (consolePollTimer.current) {
      clearTimeout(consolePollTimer.current);
      consolePollTimer.current = null;
    }
    consolePollCancelled.current = false;
    setConsoleLoading(true);
    setConsoleError("");
    const deadline = Date.now() + consolePollDeadlineMs;

    async function poll() {
      if (!enrollment) return;
      try {
        const session = await api.consoleSession(enrollment.id);
        if (consolePollCancelled.current) return; // 请求在飞行中时这一轮轮询已经作废，结果直接丢弃
        if (session.state === "ready") {
          setConsoleSession(session);
          setConsoleLoading(false);
          return;
        }
        if (Date.now() >= deadline) {
          setConsoleError("启动超时，请重试");
          setConsoleLoading(false);
          return;
        }
        consolePollTimer.current = setTimeout(() => void poll(), consolePollIntervalMs);
      } catch (caught) {
        if (consolePollCancelled.current) return;
        setConsoleError(upstreamErrorMessage(caught, REMOTE_DESKTOP_MESSAGES));
        setConsoleLoading(false);
      }
    }

    void poll();
  }

  const handleConsoleError = useCallback((message: string) => {
    setConsoleError(message);
    setConsoleSession(null);
  }, []);

  function refreshTutor() {
    if (refreshTimer.current || !enrollment) return;
    setRefreshing(true);
    refreshTimer.current = setTimeout(() => {
      api.chatMessages(enrollment.id).then((items) => {
        setMessages(items.length ? items.map((item) => ({ role: item.role, text: item.text })) : initialMessages);
      }).finally(() => { setRefreshing(false); refreshTimer.current = null; });
    }, 500);
  }

  if (!courseChecked || !course || !enrollment) {
    return <div className="app-shell"><Sidebar active="workspace" /><main className="course-required-page"><section className="course-required-card" role="status"><h1>{courseChecked ? "Choose a course first" : "Opening Learning Lab..."}</h1><p>{contentError || (courseChecked ? "Choose a course before opening its project workspace." : "Checking for your active course.")}</p>{courseChecked && <button className="primary-button" type="button" onClick={() => router.replace("/courses")}>Browse courses</button>}</section></main></div>;
  }

  const allLessons = course.modules.flatMap((module) => module.lessons.map((item) => ({ ...item, module })));
  const currentIndex = allLessons.findIndex((item) => item.id === selectedLessonId);
  const completedSteps = Math.round((enrollment.progressPercent / 100) * allLessons.length);
  const latencyBars = latency === null ? 0 : latency < 80 ? 4 : latency < 160 ? 3 : latency < 300 ? 2 : 1;

  const frameStyle = { "--course-rail-width": `${courseRailWidth}px` } as CSSProperties;

  return (
    <div className={`workspace-shell lab-shell ${courseSummaryCollapsed ? "summary-collapsed" : ""} ${tutorCollapsed ? "tutor-collapsed" : ""}`}>
      <div className="lab-frame" style={frameStyle}>
        <aside className={`lab-course-rail ${courseSummaryCollapsed ? "collapsed" : ""}`} aria-label="Course steps">
          <header className="lab-course-brand"><BrandLogo className="lab-brand-logo" /><span className="lab-brand-mark" role="img" aria-label="AIVirTeach" />{!courseSummaryCollapsed && <button className="lab-rail-toggle points-left" type="button" onClick={() => setCourseSummaryCollapsed(true)} aria-label="Collapse course steps"><span aria-hidden="true" /></button>}</header>
          {courseSummaryCollapsed && <button className="lab-course-rail-expand" type="button" onClick={() => setCourseSummaryCollapsed(false)} aria-label="Expand course steps" />}
          {!courseSummaryCollapsed && <div className="lab-course-content">
            <section className="lab-step-navigation" aria-label="Step navigation">
              <button type="button" onClick={() => selectLesson(lesson?.navigation.previousLessonId ?? null)} disabled={!lesson?.navigation.previousLessonId}>Previous step</button>
              <span>Step {currentIndex + 1} of {allLessons.length}</span>
              <button type="button" onClick={() => selectLesson(lesson?.navigation.nextLessonId ?? null)} disabled={!lesson?.navigation.nextLessonId}>Next step</button>
            </section>
            <details className="course-outline-panel"><summary>Course outline</summary><nav className="chapter-timeline course-step-outline" aria-label="Course outline"><ol>{course.modules.map((module) => {
              const moduleActive = module.lessons.some((item) => item.id === selectedLessonId);
              return <li className={moduleActive ? "active" : ""} key={module.id}>
                <div className="chapter-row"><span>{module.position}</span><div><small>Module {module.position}</small><strong>{module.title}</strong></div></div>
                <ol className="chapter-steps">{module.lessons.map((item) => {
                  const stepIndex = allLessons.findIndex((lessonItem) => lessonItem.id === item.id);
                  const status = item.id === selectedLessonId ? "current" : stepIndex < completedSteps ? "complete" : "upcoming";
                  return <li className={status} key={item.id}><button type="button" onClick={() => selectLesson(item.id)}><span>{module.position}.{item.position}</span><strong>{item.title}</strong></button></li>;
                })}</ol>
              </li>;
            })}</ol></nav></details>
            {lessonLoading || !lesson ? <p className="sidebar-lesson-loading" role="status">Loading course step...</p> : <section className="sidebar-lesson">
              <header className="sidebar-lesson-header"><span>{lesson.module.position}.{lesson.lesson.position}</span><div><small>{lesson.module.title}</small><h2>{lesson.lesson.title}</h2><p>{lesson.lesson.estimatedMinutes} minutes</p></div></header>
              {contentError && <p className="auth-error" role="alert">{contentError}</p>}
              <CourseLessonContent markdown={lesson.markdown} />
              <section className="lesson-activity sidebar-lesson-activity"><small>STEP CHECK</small><h3>{lesson.lesson.activity.prompt}</h3><button className="primary-button" type="button" onClick={() => void completeStep()} disabled={completionStatus === "Saving..."}>{lesson.navigation.nextLessonId ? "Complete and continue" : "Complete course"}</button>{completionStatus && <p role="status">{completionStatus}</p>}</section>
            </section>}
          </div>}
          <AccountMenu placement="lab" collapsed={courseSummaryCollapsed} onVmEnv={() => setVmEnvOpen(true)} />
          {!courseSummaryCollapsed && <div className="lab-course-resizer" role="separator" aria-label="Resize course sidebar" aria-orientation="vertical" aria-valuemin={minCourseRailWidth} aria-valuemax={maxCourseRailWidth} aria-valuenow={courseRailWidth} tabIndex={0} onPointerDown={startCourseRailResize} onKeyDown={resizeCourseRailWithKeyboard} />}
        </aside>

        <header className="lab-project-header"><div className="lab-project-title"><small>COURSE</small><h1>{course.title}</h1></div><div className="lab-project-status"><div className="latency-status"><span className="latency-bars" aria-hidden="true">{[1,2,3,4].map((bar) => <i className={bar <= latencyBars ? "active" : ""} key={bar} />)}</span><span><small>SERVER</small><strong>{latency === null ? "Offline" : `${latency} ms`}</strong></span></div><div className="lab-active-timer"><span className="timer-glyph" aria-hidden="true" /><span><small>ACTIVE TIME</small><strong>{formatElapsed(elapsedSeconds)}</strong></span></div></div></header>

        <main className="lab-workspace vm-workspace">
          <header className="vm-toolbar"><div><span className="vm-status-dot" aria-hidden="true" /><strong>Learning VM</strong></div><div className="vm-toolbar-actions"><small>{workspace?.status === "RUNNING" && consoleSession ? "Connected workspace" : "Awaiting connection"}</small>{workspace?.status === "RUNNING" && <button type="button" className="vm-close-button" onClick={closeEnvironment} disabled={stopping}>{stopping ? "Closing..." : "Close environment"}</button>}</div></header>
          {workspace?.status === "RUNNING" && consoleSession?.state === "ready" && consoleSession.data ? (
            <ConsoleViewer
              data={consoleSession.data}
              labId={consoleSession.labId}
              enrollmentId={enrollment.id}
              onError={handleConsoleError}
            />
          ) : workspace?.status === "RUNNING" ? (
            <section className="vm-empty-state" role="status">
              <span className="vm-display-icon" aria-hidden="true" />
              <h2>Learning VM</h2>
              {consoleError && <p className="auth-error" role="alert">{consoleError}</p>}
              <button className="primary-button" type="button" onClick={() => void startConsoleSession()} disabled={consoleLoading}>
                {consoleLoading ? "Starting..." : "Start remote desktop"}
              </button>
            </section>
          ) : workspace?.status === "STOPPED" ? (
            <section className="vm-empty-state" role="status">
              <span className="vm-display-icon" aria-hidden="true" />
              <h2>Learning VM</h2>
              <p>Your Learning VM is closed. Resume it to keep working.</p>
              <button className="primary-button" type="button" onClick={resumeWorkspace} disabled={resuming}>{resuming ? "Resuming..." : "Resume learning environment"}</button>
            </section>
          ) : workspace?.status === "ERROR" ? (
            <section className="vm-empty-state" role="status">
              <span className="vm-display-icon" aria-hidden="true" />
              <h2>Learning VM</h2>
              <p>{workspace.errorMessage || "Could not start your Learning VM."}</p>
              <button className="primary-button" type="button" onClick={retryWorkspace} disabled={retrying}>{retrying ? "Retrying..." : "Retry"}</button>
            </section>
          ) : (
            <section className="vm-empty-state" role="status">
              <span className="vm-display-icon" aria-hidden="true" />
              <h2>Learning VM</h2>
              <p>Preparing your Learning VM. This can take a few minutes.</p>
            </section>
          )}
        </main>

        <aside className={`lab-tutor-rail ${tutorCollapsed ? "collapsed" : ""}`} aria-label="AI teacher">{tutorCollapsed ? <button className="lab-tutor-expand" type="button" onClick={() => setTutorCollapsed(false)} aria-label="Expand AI teacher"><span className="bot-mark">AI</span><i className="collapse-glyph points-left" aria-hidden="true" /></button> : <><header><div className="tutor-heading"><span className="bot-mark">AI</span><div><strong>AIVir Teacher</strong><small><i /> Online</small></div></div><div className="tutor-header-actions"><button className={`tutor-refresh ${refreshing ? "refreshing" : ""}`} type="button" onClick={refreshTutor} aria-label="Refresh tutor conversation"><img src="/refresh-icon.png" alt="" aria-hidden="true" /></button><button className="lab-rail-toggle points-right" type="button" onClick={() => setTutorCollapsed(true)} aria-label="Collapse AI teacher"><span aria-hidden="true" /></button></div></header><div className={`messages ${refreshing ? "refreshing" : ""}`}>{messages.map((item, index) => <article className={`message ${item.role}`} key={`${item.role}-${index}`}><div>{item.role === "tutor" ? <Markdown extensions={markdownExtensions} components={markdownComponents}>{item.text}</Markdown> : <p>{item.text}</p>}<small>{index === messages.length - 1 && !streaming ? "Just now" : "Earlier"}</small></div></article>)}{streaming && <article className="message tutor pending"><div>{streamingText ? <Markdown extensions={markdownExtensions} components={markdownComponents}>{streamingText}</Markdown> : <p className="tutor-progress">{streamingProgress ?? "..."}</p>}<small>Just now</small></div></article>}</div><form className="message-form" onSubmit={sendMessage}><input value={message} onChange={(event) => setMessage(event.target.value)} aria-label="Ask the tutor for help" placeholder="Ask about this step..." disabled={streaming} /><button aria-label="Send message" disabled={streaming}>Send</button></form></> }</aside>
      </div>
      {vmEnvOpen && <div className="vm-env-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setVmEnvOpen(false); }}>
        <section className="vm-env-dialog" role="dialog" aria-modal="true" aria-labelledby="vm-env-title" aria-describedby="vm-env-description">
          <header><div><small>COURSE ENVIRONMENT</small><h2 id="vm-env-title">VM Env</h2></div><button type="button" aria-label="Close VM environment requirements" onClick={() => setVmEnvOpen(false)} ref={vmEnvCloseButtonRef}><span aria-hidden="true" /></button></header>
          <p id="vm-env-description">{course.title}</p>
          <ul>{course.requirements.map((requirement) => <li key={requirement}><span aria-hidden="true">✓</span><strong>{requirement}</strong></li>)}</ul>
          <footer><button className="primary-button" type="button" onClick={() => setVmEnvOpen(false)}>Done</button></footer>
        </section>
      </div>}
    </div>
  );
}
