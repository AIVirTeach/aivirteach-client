"use client";

import { hasTutorVersionMismatch, loadedTutorContext, tutorContextKey } from "./tutor-context";
import { useTutorRequest } from "./use-tutor-request";
import { initialLessonId } from "./course-lesson-loader";
import { useChatMessages } from "./use-chat-messages";
import { useLessonSelection } from "./use-lesson-selection";
import { useLearningProgress } from "./use-learning-progress";
import { LessonCompletionButton } from "./LessonCompletionButton";
import { useBrowserNumber } from "../hooks/use-browser-number";
import { useConsoleSession } from "./use-console-session";

import { useRouter } from "next/navigation";
import { type CSSProperties, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AccountMenu } from "../components/AccountMenu";
import { BrandLogo } from "../components/BrandLogo";
import { LessonBlocks } from "../components/LessonBlocks";
import { Sidebar } from "../components/Sidebar";
import { api, ApiError, beaconStopWorkspace, getAccessToken, type ApiCourseDetail, type ApiEnrollment, type ApiLesson, type ApiWorkspace } from "../lib/api";
import { parseSseStream } from "../lib/sse";
import { subscribeWorkspace } from "../lib/ws";
import { ConsoleViewer } from "./console-viewer";
import { heartbeatIntervalMs, isHeartbeatDue } from "./heartbeat";
import { TypingIndicator } from "./typing-indicator";
import { parseChatStreamFrame } from "./chat-stream-frame";
import { TutorMessage } from "./tutor-message";
import { typewriterChunks, typewriterDelayMs } from "./typewriter";
import { upstreamErrorMessage, type UpstreamErrorMessages } from "./upstream-error";
import { getServerInterfaceVersion, getStoredInterfaceVersion, subscribeToInterfaceVersion } from "../lib/interface-version";
import { WorkspaceV2 } from "./workspace-v2";
import { localize, useLearningLanguage } from "../lib/language";

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
  const interfaceVersion = useSyncExternalStore(subscribeToInterfaceVersion, getStoredInterfaceVersion, getServerInterfaceVersion);
  return interfaceVersion === "v1" ? <WorkspaceV1 /> : <WorkspaceV2 />;
}

function WorkspaceV1() {
  const router = useRouter();
  const language = useLearningLanguage();
  const t = (english: string, chinese: string) => localize(language, english, chinese);
  const [course, setCourse] = useState<ApiCourseDetail | null>(null);
  const [enrollment, setEnrollment] = useState<ApiEnrollment | null>(null);
  const [workspace, setWorkspace] = useState<ApiWorkspace | null>(null);
  const [loadedLesson, setLoadedLesson] = useState<{ key: string; status: "ready"; lesson: ApiLesson } | { key: string; status: "error"; message: string } | null>(null);
  const [lessonAttempt, setLessonAttempt] = useState(0);
  const [courseChecked, setCourseChecked] = useState(false);
  const [contentError, setContentError] = useState("");
  const learning = useLearningProgress(course?.id, course?.version);
  const { snapshot: learningSnapshot, visit: visitLesson } = learning;
  const lessonKey = course && learningSnapshot ? `${course.id}:${course.version}:${learningSnapshot.courseVersionId}:${learningSnapshot.generation}` : "";
  const initialSelectionId = course && learningSnapshot ? initialLessonId(course, learningSnapshot) : "";
  const { selectedId: selectedLessonId, select: setSessionLesson } = useLessonSelection(lessonKey, initialSelectionId);
  const loadedLessonForSelection = loadedLesson?.key === `${lessonKey}:${selectedLessonId}` ? loadedLesson : null;
  const lesson = loadedLessonForSelection?.status === "ready" ? loadedLessonForSelection.lesson : null;
  const lessonLoading = Boolean(course && selectedLessonId && !loadedLessonForSelection);
  const initialVisitKey = useRef("");
  const [message, setMessage] = useState("");
  const { messages, appendMessage, loadMessages } = useChatMessages(enrollment?.id, learningSnapshot?.generation, initialMessages);
  const chatContext = loadedTutorContext(course, selectedLessonId, lessonLoading ? null : lesson, learning.snapshot);
  const chatKey = tutorContextKey(enrollment?.id, chatContext);
  const chat = useTutorRequest(chatKey);
  const streaming = chat.busy;
  const [streamingTextState, setStreamingTextState] = useState<{ key: string; text: string } | null>(null);
  const streamingText = streamingTextState?.key === chatKey ? streamingTextState.text : "";
  const [refreshing, setRefreshing] = useState(false);
  const [courseSummaryCollapsed, setCourseSummaryCollapsed] = useState(false);
  const [tutorCollapsed, setTutorCollapsed] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useBrowserNumber(course ? `aivirteach.lab.activeSeconds.${course.id}` : "aivirteach.lab.activeSeconds.none", 0);
  const [latency, setLatency] = useState<number | null>(null);
  const [courseRailWidth, setCourseRailWidth] = useBrowserNumber(courseRailWidthStorageKey, 420, { min: minCourseRailWidth, max: maxCourseRailWidth });
  const [vmEnvOpen, setVmEnvOpen] = useState(false);
  const formatConsolePollError = useCallback((caught: unknown) => upstreamErrorMessage(caught, REMOTE_DESKTOP_MESSAGES), []);
  const consoleState = useConsoleSession({
    enrollmentId: enrollment?.id,
    workspace,
    timeoutMessage: t("Remote desktop startup timed out. Please retry.", "启动超时，请重试"),
    formatPollError: formatConsolePollError,
  });
  const visibleConsoleSession = consoleState.session;
  const [retrying, setRetrying] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [resuming, setResuming] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vmEnvCloseButtonRef = useRef<HTMLButtonElement>(null);



  useEffect(() => {
    let active = true;
    api.enrollments().then(async (enrollments) => {
      const activeEnrollment = enrollments.find((item) => item.active);
      if (!activeEnrollment) return;
      const courseData = await api.course(activeEnrollment.courseId);
      if (!active) return;
      setEnrollment(activeEnrollment);
      setCourse(courseData);
    }).catch(() => {
      if (active) setContentError("Could not load the course.");
    }).finally(() => { if (active) setCourseChecked(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!enrollment) return;
    const enrollmentId = enrollment.id;
    let active = true;
    let unsubscribe: (() => void) | null = null;

    async function ensureWorkspace() {
      let current: ApiWorkspace;
      try {
        current = await api.workspace(enrollmentId);
      } catch (caught) {
        if (!(caught instanceof ApiError) || caught.status !== 404) throw caught;
        current = await api.createWorkspace(enrollmentId);
      }
      if (!active) return;
      setWorkspace(current);
      unsubscribe = subscribeWorkspace(enrollmentId, (updated) => { if (active) setWorkspace(updated); });
    }

    ensureWorkspace().catch((caught) => {
      if (active) setContentError(upstreamErrorMessage(caught, VM_MESSAGES));
    });

    return () => { active = false; unsubscribe?.(); };
  }, [enrollment]);

  useEffect(() => {
    const snapshot = learningSnapshot;
    if (!course || !snapshot) return;
    const key = `${course.id}:${snapshot.courseVersionId}:${snapshot.generation}`;
    if (initialVisitKey.current === key) return;
    const id = initialLessonId(course, snapshot);
    if (id) { initialVisitKey.current = key; void visitLesson(id); }
  }, [course, learningSnapshot, visitLesson]);

  // WS 推送在服务端 waitUntil 后台任务被 Vercel 回收时不会产生任何广播（DB 也不会
  // 更新），重连 WS 接不到一条不存在的消息——这种情况下只有客户端主动重新 GET 才能
  // 触发服务端 getForEnrollment 里"createdAt 超过 5 分钟即判超时"的兜底。轮询作为
  // 兜底而非替代：一旦状态变为终态就自动停止，不影响 WS 推送到达时的即时更新。
  useEffect(() => {
    if (!enrollment || (workspace?.status !== "CREATING" && workspace?.status !== "RESETTING")) return;
    let active = true;
    const interval = window.setInterval(() => {
      api.workspace(enrollment.id)
        .then((updated) => { if (active) setWorkspace(updated); })
        .catch(async (caught) => {
          if (!active || !(caught instanceof ApiError) || caught.status !== 404) return;
          try {
            const created = await api.createWorkspace(enrollment.id);
            if (active) setWorkspace(created);
          } catch {
            // 下次轮询继续尝试；服务端会保留待清理记录并重试 Labs 删除。
          }
        });
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
    api.lesson(course.id, selectedLessonId).then((lessonData) => {
      if (!active) return;
      setLoadedLesson({ key: `${lessonKey}:${selectedLessonId}`, status: "ready", lesson: lessonData });
    }).catch(() => {
      if (active) setLoadedLesson({ key: `${lessonKey}:${selectedLessonId}`, status: "error", message: "Could not load this step. / 无法加载此课时。" });
    });
    return () => { active = false; };
  }, [course, lessonKey, selectedLessonId, lessonAttempt]);

  useEffect(() => {
    if (!course) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [course, setElapsedSeconds]);

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

  function selectLesson(lessonId: string | null) {
    if (lessonId && course && learningSnapshot) {
      setSessionLesson(lessonId);
      void visitLesson(lessonId);
    }
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

  async function revealTutorText(text: string, signal: AbortSignal) {
    let accumulated = "";
    for (const chunk of typewriterChunks(text)) {
      if (signal.aborted) return;
      accumulated += chunk;
      setStreamingTextState({ key: chatKey, text: accumulated });
      await new Promise((resolve) => setTimeout(resolve, typewriterDelayMs()));
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment || streaming || !chatContext) return;
    const text = message.trim();
    if (!text) return;
    const request = chat.begin();
    if (!request) return;
    setMessage("");
    appendMessage({ role: "student", text });
    setStreamingTextState({ key: chatKey, text: "" });
    try {
      const response = await api.streamChatMessage(enrollment.id, { requestId: crypto.randomUUID(), text, context: chatContext }, request.signal);
      if (!response.body) throw new Error("The tutor is unavailable.");

      let tutorText: string | null = null;
      for await (const frame of parseSseStream(response.body)) {
        const parsed = parseChatStreamFrame(frame.data);
        if (!parsed || parsed.type === "progress") continue;
        tutorText = parsed.tutorMessage.text;
      }

      if (tutorText === null) throw new Error("The tutor is unavailable.");
      await revealTutorText(tutorText, request.signal);
      if (!request.isCurrent()) return;
      appendMessage({ role: "tutor", text: tutorText! });
    } catch (caught) {
      // 上面两处 throw new Error(...) 不是 ApiError，upstreamErrorMessage 会把它们归为
      // retryable（提示重试）而不是 unavailable——这是有意为之：响应体缺失/流结束却没有最终
      // 消息通常是瞬时的网络或流式问题，值得让用户重试，不该直接判定为服务不可用。
      if (!request.isCurrent()) return;
      appendMessage({ role: "tutor", text: upstreamErrorMessage(caught, AGENT_MESSAGES) });
    } finally {
      if (request.isCurrent()) setStreamingTextState(null);
      request.finish();
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
    consoleState.stop();
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

  const startConsoleSession = consoleState.start;
  const handleConsoleError = consoleState.reportViewerError;

  function refreshTutor() {
    if (refreshTimer.current || !enrollment) return;
    setRefreshing(true);
    refreshTimer.current = setTimeout(() => {
      void loadMessages(initialMessages).finally(() => { setRefreshing(false); refreshTimer.current = null; });
    }, 500);
  }

  if (!courseChecked || !course || !enrollment) {
    return <div className="app-shell"><Sidebar active="workspace" /><main className="course-required-page"><Card as="section" className="course-required-card" role="status"><h1>{courseChecked ? t("Choose a course first", "请先选择课程") : t("Opening Learning Lab...", "正在打开学习实验室……")}</h1><p>{contentError || (courseChecked ? t("Choose a course before opening its project workspace.", "请先选择课程，再打开项目工作区。") : t("Checking for your active course.", "正在检查进行中的课程。"))}</p>{courseChecked && <Button className="primary-button" size="lg" type="button" onClick={() => router.replace("/courses")}>{t("Browse courses", "浏览课程")}</Button>}</Card></main></div>;
  }

  const allLessons = course.modules.flatMap((module) => module.lessons.map((item) => ({ ...item, module })));
  const currentIndex = allLessons.findIndex((item) => item.id === selectedLessonId);

  const latencyBars = latency === null ? 0 : latency < 80 ? 4 : latency < 160 ? 3 : latency < 300 ? 2 : 1;

  const frameStyle = { "--course-rail-width": `${courseRailWidth}px` } as CSSProperties;

  return (
    <div className={`workspace-shell lab-shell ${courseSummaryCollapsed ? "summary-collapsed" : ""} ${tutorCollapsed ? "tutor-collapsed" : ""}`}>
      <div className="lab-frame" style={frameStyle}>
        <Card as="aside" className={`lab-course-rail ${courseSummaryCollapsed ? "collapsed" : ""}`} aria-label="Course steps">
          <header className="lab-course-brand"><BrandLogo className="lab-brand-logo" /><span className="lab-brand-mark" role="img" aria-label="AIVirTeach" />{!courseSummaryCollapsed && <Button className="lab-rail-toggle points-left" variant="ghost" size="icon" type="button" onClick={() => setCourseSummaryCollapsed(true)} aria-label="Collapse course steps"><span aria-hidden="true" /></Button>}</header>
          {courseSummaryCollapsed && <Button className="lab-course-rail-expand" variant="ghost" size="icon" type="button" onClick={() => setCourseSummaryCollapsed(false)} aria-label="Expand course steps" />}
          {!courseSummaryCollapsed && <div className="lab-course-content">
            <section className="lab-step-navigation" aria-label="Step navigation">
              <Button variant="outline" size="sm" type="button" onClick={() => selectLesson(lesson?.navigation.previousLessonId ?? null)} disabled={!learning.snapshot?.active || !lesson?.navigation.previousLessonId}>{t("Previous step", "上一步")}</Button>
              <span>Step {currentIndex + 1} of {allLessons.length}</span>
              <Button variant="outline" size="sm" type="button" onClick={() => selectLesson(lesson?.navigation.nextLessonId ?? null)} disabled={!learning.snapshot?.active || !lesson?.navigation.nextLessonId}>{t("Next step", "下一步")}</Button>
            </section>
            <Collapsible className="course-outline-panel"><CollapsibleTrigger render={<Button className="course-outline-trigger" variant="ghost" type="button" />}>{t("Course outline", "课程大纲")}</CollapsibleTrigger><CollapsibleContent><nav className="chapter-timeline course-step-outline" aria-label={t("Course outline", "课程大纲")}><ol>{course.modules.map((module) => {
              const moduleActive = module.lessons.some((item) => item.id === selectedLessonId);
              return <li className={moduleActive ? "active" : ""} key={module.id}>
                <div className="chapter-row"><span>{module.position}</span><div><small>Module {module.position}</small><strong>{module.title}</strong></div></div>
                <ol className="chapter-steps">{module.lessons.map((item) => {
                  const status = item.id === selectedLessonId ? "current" : learning.snapshot?.completedLessonIds.includes(item.id) ? "complete" : "upcoming";
                  return <li className={status} key={item.id}><Button variant="ghost" type="button" disabled={!learning.snapshot?.active} onClick={() => selectLesson(item.id)}><span>{module.position}.{item.position}</span><strong>{item.title}</strong></Button></li>;
                })}</ol>
              </li>;
            })}</ol></nav></CollapsibleContent></Collapsible>
            {lessonLoading ? <p className="sidebar-lesson-loading" role="status">Loading course step...</p> : loadedLessonForSelection?.status === "error" ? <div role="alert"><Alert className="auth-error" variant="destructive">{loadedLessonForSelection.message}</Alert><Button variant="outline" type="button" onClick={() => setLessonAttempt((value) => value + 1)}>重试 / Retry</Button></div> : !lesson || lesson.lesson.id !== selectedLessonId ? <p className="sidebar-lesson-loading" role="status">Loading course step...</p> : <section className="sidebar-lesson">
              <header className="sidebar-lesson-header"><span>{lesson.module.position}.{lesson.lesson.position}</span><div><small>{lesson.module.title}</small><h2>{lesson.lesson.title}</h2><p>{lesson.lesson.estimatedMinutes} minutes</p></div></header>
              {lesson.blocks.length === 0
                ? <p role="status">暂无课时内容 · No lesson content yet</p>
                : <LessonBlocks blocks={lesson.blocks} assets={lesson.assets ?? {}} mode="learner" />}
            </section>}
            <LessonCompletionButton lessonId={selectedLessonId} progress={learning} disabled={lessonLoading || !lesson || lesson.lesson.id !== selectedLessonId} />
          </div>}
          <AccountMenu placement="lab" collapsed={courseSummaryCollapsed} onVmEnv={() => setVmEnvOpen(true)} />
          {!courseSummaryCollapsed && <div className="lab-course-resizer" role="separator" aria-label="Resize course sidebar" aria-orientation="vertical" aria-valuemin={minCourseRailWidth} aria-valuemax={maxCourseRailWidth} aria-valuenow={courseRailWidth} tabIndex={0} onPointerDown={startCourseRailResize} onKeyDown={resizeCourseRailWithKeyboard} />}
        </Card>

        <header className="lab-project-header"><div className="lab-project-title"><small>{t("COURSE", "课程")}</small><h1>{course.title}</h1></div><div className="lab-project-status"><div className="latency-status"><span className="latency-bars" aria-hidden="true">{[1,2,3,4].map((bar) => <i className={bar <= latencyBars ? "active" : ""} key={bar} />)}</span><span><small>{t("SERVER", "服务器")}</small><strong>{latency === null ? t("Offline", "离线") : `${latency} ms`}</strong></span></div><div className="lab-active-timer"><span className="timer-glyph" aria-hidden="true" /><span><small>{t("ACTIVE TIME", "有效时间")}</small><strong>{formatElapsed(elapsedSeconds)}</strong></span></div></div></header>

        <main className="lab-workspace vm-workspace">
          <header className="vm-toolbar"><div><span className="vm-status-dot" aria-hidden="true" /><strong>{t("Learning VM", "学习虚拟机")}</strong></div><div className="vm-toolbar-actions"><small>{visibleConsoleSession ? t("Connected workspace", "工作区已连接") : t("Awaiting connection", "等待连接")}</small>{workspace?.status === "RUNNING" && <Button type="button" variant="destructive" size="xs" className="vm-close-button" onClick={closeEnvironment} disabled={stopping}>{stopping ? t("Closing...", "正在关闭……") : t("Close environment", "关闭环境")}</Button>}</div></header>
          {workspace?.status === "RUNNING" && visibleConsoleSession?.state === "ready" && visibleConsoleSession.data ? (
            <ConsoleViewer
              data={visibleConsoleSession.data}
              labId={visibleConsoleSession.labId}
              enrollmentId={enrollment.id}
              onError={handleConsoleError}
            />
          ) : workspace?.status === "RUNNING" ? (
            <section className="vm-empty-state" role="status">
              <span className="vm-display-icon" aria-hidden="true" />
              <h2>Learning VM</h2>
              {consoleState.error && <Alert className="auth-error" variant="destructive">{consoleState.error}</Alert>}
              <Button className="primary-button" size="lg" type="button" onClick={() => void startConsoleSession()} disabled={consoleState.loading || stopping}>
                {consoleState.loading ? "Starting..." : "Start remote desktop"}
              </Button>
            </section>
          ) : workspace?.status === "STOPPED" ? (
            <section className="vm-empty-state" role="status">
              <span className="vm-display-icon" aria-hidden="true" />
              <h2>Learning VM</h2>
              <p>Your Learning VM is closed. Resume it to keep working.</p>
              <Button className="primary-button" size="lg" type="button" onClick={resumeWorkspace} disabled={resuming}>{resuming ? "Resuming..." : "Resume learning environment"}</Button>
            </section>
          ) : workspace?.status === "ERROR" ? (
            <section className="vm-empty-state" role="status">
              <span className="vm-display-icon" aria-hidden="true" />
              <h2>Learning VM</h2>
              <p>{workspace.errorMessage || "Could not start your Learning VM."}</p>
              <Button className="primary-button" size="lg" type="button" onClick={retryWorkspace} disabled={retrying}>{retrying ? "Retrying..." : "Retry"}</Button>
            </section>
          ) : (
            <section className="vm-empty-state" role="status">
              <span className="vm-display-icon" aria-hidden="true" />
              <h2>Learning VM</h2>
              <p>{workspace?.status === "RESETTING" ? t("Clearing the previous Learning VM. This can take a few minutes.", "正在清理之前的学习虚拟机，可能需要几分钟。") : t("Preparing your Learning VM. This can take a few minutes.", "正在准备学习虚拟机，可能需要几分钟。")}</p>
            </section>
          )}
        </main>

        <Card as="aside" className={`lab-tutor-rail ${tutorCollapsed ? "collapsed" : ""}`} aria-label={t("AI teacher", "AI 教师")}>{tutorCollapsed ? <Button className="lab-tutor-expand" variant="ghost" size="icon" type="button" onClick={() => setTutorCollapsed(false)} aria-label={t("Expand AI teacher", "展开 AI 教师")}><span className="bot-mark">AI</span><i className="collapse-glyph points-left" aria-hidden="true" /></Button> : <><header><div className="tutor-heading"><span className="bot-mark">AI</span><div><strong>AIVir Teacher</strong><small><i /> {t("Online", "在线")}</small></div></div><div className="tutor-header-actions"><Button className={`tutor-refresh ${refreshing ? "refreshing" : ""}`} variant="ghost" size="icon" type="button" onClick={refreshTutor} aria-label={t("Refresh tutor conversation", "刷新教师对话")}><img src="/refresh-icon.png" alt="" aria-hidden="true" /></Button><Button className="lab-rail-toggle points-right" variant="ghost" size="icon" type="button" onClick={() => setTutorCollapsed(true)} aria-label={t("Collapse AI teacher", "收起 AI 教师")}><span aria-hidden="true" /></Button></div></header><div className={`messages ${refreshing ? "refreshing" : ""}`}>{messages.map((item, index) => <article className={`message ${item.role}`} key={`${item.role}-${index}`}><div>{item.role === "tutor" ? <TutorMessage text={item.text} /> : <p>{item.text}</p>}<small>{index === messages.length - 1 && !streaming ? t("Just now", "刚刚") : t("Earlier", "较早")}</small></div></article>)}{streaming && <article className="message tutor pending"><div>{streamingText ? <TutorMessage text={streamingText} /> : <TypingIndicator />}<small>{t("Just now", "刚刚")}</small></div></article>}</div>{hasTutorVersionMismatch(course, selectedLessonId, lesson, learning.snapshot) && <div role="alert"><p>{t("This lesson does not match the active course version. Reload the course before asking the tutor.", "当前课时与课程版本不匹配，请刷新课程后再向教师提问。")}</p><Button variant="outline" type="button" onClick={() => window.location.reload()}>{t("Reload course", "刷新课程")}</Button></div>}<form className="message-form" onSubmit={sendMessage}><Input value={message} onChange={(event) => setMessage(event.target.value)} aria-label={t("Ask the tutor for help", "向教师寻求帮助")} placeholder={t("Ask about this step...", "询问此步骤……")} disabled={streaming || !chatContext} /><Button size="icon" type="submit" aria-label={t("Send message", "发送消息")} disabled={streaming || !chatContext}>{t("Send", "发送")}</Button></form></> }</Card>
      </div>
      <Dialog open={vmEnvOpen} onOpenChange={setVmEnvOpen}>
        {vmEnvOpen && <DialogContent className="vm-env-dialog" showCloseButton={false}>
          <header><div><small>COURSE ENVIRONMENT</small><DialogTitle id="vm-env-title">VM Env</DialogTitle></div><Button variant="ghost" size="icon" type="button" aria-label="Close VM environment requirements" onClick={() => setVmEnvOpen(false)} ref={vmEnvCloseButtonRef}><span aria-hidden="true" /></Button></header>
          <DialogDescription id="vm-env-description">{course.title}</DialogDescription>
          <ul>{course.requirements.map((requirement) => <li key={requirement}><span aria-hidden="true">✓</span><strong>{requirement}</strong></li>)}</ul>
          <footer><Button className="primary-button" size="lg" type="button" onClick={() => setVmEnvOpen(false)}>Done</Button></footer>
        </DialogContent>}
      </Dialog>
    </div>
  );
}
