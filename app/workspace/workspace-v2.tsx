"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Maximize2, Minimize2, Send, Wifi, WifiOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "../components/BrandLogo";
import { api, ApiError, beaconStopWorkspace, getAccessToken, type ApiCourseDetail, type ApiEnrollment, type ApiWorkspace } from "../lib/api";
import { applyLearningLanguage, localize, useLearningLanguage } from "../lib/language";
import { ConsoleViewer, type ConsoleViewerHandle } from "./console-viewer";
import { heartbeatIntervalMs, isHeartbeatDue } from "./heartbeat";
import { upstreamErrorMessage } from "./upstream-error";
import { CourseLearningPath } from "./CourseLearningPath";
import { useBrowserNumber } from "../hooks/use-browser-number";
import { useBrowserJson } from "../hooks/use-browser-json";
import { useConsoleSession } from "./use-console-session";
import { parseFloatingPosition, type FloatingPosition } from "./floating-position";
import { TutorMessage } from "./tutor-message";
import { vmPanelState } from "./vm-panel-state";
import { hasTutorVersionMismatch, loadedTutorContext, tutorContextKey } from "./tutor-context";
import { useCourseLearningSession } from "./use-course-learning-session";
import { useChatMessages } from "./use-chat-messages";
import { readTutorStream, TutorReplyNotSavedError } from "./read-tutor-stream";
import { initialTutorReply, replyDraft, type TutorReplyState } from "./tutor-reply-state";
import { useTutorRequest } from "./use-tutor-request";

type HistoryRefresh = "idle" | "loading" | "loaded" | "failed";

type TutorDisplay =
  | { kind: "active"; key: string; reply: TutorReplyState }
  | { kind: "interrupted"; key: string; refresh: HistoryRefresh }
  | { kind: "failed"; key: string; message: string; refresh: HistoryRefresh };

type Message = { role: "tutor" | "student"; text: string };
type WorkspaceTab = "teacher" | "path";
type WorkspaceLayout = "split" | "maximized" | "minimized";

const initialMessages: Message[] = [
  { role: "tutor", text: "I am ready to help with this course. Tell me what you are trying to do or where the result differs from the learning path." },
];
const widthStorageKey = "aivirteach.lab.v2.leftWidth";
const floatingPositionStorageKey = "aivirteach.lab.v2.floatingAiPosition";
const minLeftWidth = 450;
const maxLeftWidth = Number.MAX_SAFE_INTEGER;
const minVmWidth = 420;
const floatingButtonSize = 64;
const floatingViewportMargin = 14;
const floatingPromptGap = 12;
const floatingPromptMaxWidth = 340;
const floatingPositionServerFallback: FloatingPosition = { x: -100, y: -100 };
function defaultFloatingPosition(): FloatingPosition {
  return { x: window.innerWidth - floatingButtonSize - 28, y: window.innerHeight - floatingButtonSize - 28 };
}
function clampFloatingPosition(position: FloatingPosition): FloatingPosition {
  return {
    x: Math.min(window.innerWidth - floatingButtonSize - floatingViewportMargin, Math.max(floatingViewportMargin, position.x)),
    y: Math.min(window.innerHeight - floatingButtonSize - floatingViewportMargin, Math.max(floatingViewportMargin, position.y)),
  };
}
function floatingPromptWidth() {
  return Math.min(floatingPromptMaxWidth, window.innerWidth - (floatingViewportMargin * 2) - floatingButtonSize - floatingPromptGap);
}

function floatingPromptMinX() {
  return floatingViewportMargin + Math.max(0, floatingPromptWidth()) + floatingPromptGap;
}

export function WorkspaceV2() {
  const router = useRouter();
  const learningLanguage = useLearningLanguage();
  const t = (english: string, chinese: string) => localize(learningLanguage, english, chinese);
  const shellRef = useRef<HTMLDivElement>(null);
  const floatingPromptRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const consoleViewerRef = useRef<ConsoleViewerHandle>(null);
  const floatingWasDraggedRef = useRef(false);
  const [course, setCourse] = useState<ApiCourseDetail | null>(null);
  const [enrollment, setEnrollment] = useState<ApiEnrollment | null>(null);
  const enrollmentId = enrollment?.id;
  const [workspace, setWorkspace] = useState<ApiWorkspace | null>(null);
  const refreshWorkspace = useCallback(() => {
    if (!enrollmentId) return;
    api.workspace(enrollmentId).then(setWorkspace).catch(() => undefined);
  }, [enrollmentId]);
  const formatConsolePollError = useCallback((caught: unknown) => caught instanceof Error ? caught.message : "Could not start the remote desktop.", []);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("path");
  const [leftWidth, setLeftWidth] = useBrowserNumber(widthStorageKey, 680, { min: minLeftWidth, max: maxLeftWidth });
  const [layout, setLayout] = useState<WorkspaceLayout>("split");
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const consoleState = useConsoleSession({
    enrollmentId,
    workspace,
    timeoutMessage: "The remote desktop took too long to start. Please retry.",
    formatPollError: formatConsolePollError,
    onViewerError: refreshWorkspace,
    onPollError: refreshWorkspace,
  });
  const consoleSession = consoleState.session;
  const consoleError = consoleState.error;
  const consoleLoading = consoleState.loading;
  const [retrying, setRetrying] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const [latency, setLatency] = useState<number | null>(null);
  const [envVariablesOpen, setEnvVariablesOpen] = useState(false);
  const [floatingPromptOpen, setFloatingPromptOpen] = useState(false);
  const [floatingPrompt, setFloatingPrompt] = useState("");
  const [floatingOwner, setFloatingOwner] = useState<{ id: string; contextKey: string } | null>(null);
  const [floatingUnreadKey, setFloatingUnreadKey] = useState<string | null>(null);
  const [savedFloatingPosition, setSavedFloatingPosition] = useBrowserJson(floatingPositionStorageKey, floatingPositionServerFallback, defaultFloatingPosition, parseFloatingPosition, clampFloatingPosition);
  const [draggedFloatingPosition, setDraggedFloatingPosition] = useState<FloatingPosition | null>(null);
  const floatingPosition = draggedFloatingPosition ?? savedFloatingPosition;
  const learningSession = useCourseLearningSession(course);
  const { messages, appendMessage, loadMessages } = useChatMessages(enrollment?.id, learningSession.progress.snapshot?.generation, initialMessages);
  const displayedLesson = learningSession.state?.status === "ready" && learningSession.state.id === learningSession.selectedId ? learningSession.state.lesson : null;
  const chatContext = loadedTutorContext(course, learningSession.selectedId, displayedLesson, learningSession.progress.snapshot);
  const tutorVersionMismatch = hasTutorVersionMismatch(course, learningSession.selectedId, displayedLesson, learningSession.progress.snapshot);
  const chatKey = tutorContextKey(enrollment?.id, chatContext);
  const chat = useTutorRequest(chatKey);
  const [tutorDisplay, setTutorDisplay] = useState<TutorDisplay | null>(null);
  const currentTutorDisplay = tutorDisplay?.key === chatKey ? tutorDisplay : null;
  const pendingReply = chat.busy && currentTutorDisplay?.kind === "active" ? currentTutorDisplay.reply : null;
  const tutorDraft = pendingReply ? replyDraft(pendingReply) : "";
  const floatingThinking = floatingOwner?.contextKey === chatKey;
  const floatingUnread = floatingUnreadKey === chatKey;

  useEffect(() => {
    let active = true;
    api.enrollments().then(async (enrollments) => {
      const current = enrollments.find((item) => item.active);
      if (!current) return;
      const courseData = await api.course(current.courseId);
      if (!active) return;
      setEnrollment(current);
      setCourse(courseData);

    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : "Could not open Learning Lab V2.");
    }).finally(() => { if (active) setChecked(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!enrollment) return;
    let active = true;
    async function ensureWorkspace() {
      try {
        const current = await api.workspace(enrollment!.id);
        if (active) setWorkspace(current);
      } catch (caught) {
        if (!(caught instanceof ApiError) || caught.status !== 404) throw caught;
        const created = await api.createWorkspace(enrollment!.id);
        if (active) setWorkspace(created);
      }
    }
    void ensureWorkspace().catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not prepare the workspace."); });
    return () => { active = false; };
  }, [enrollment]);

  useEffect(() => {
    if (!enrollment || (workspace?.status !== "CREATING" && workspace?.status !== "RESETTING")) return;
    let active = true;
    const timer = window.setInterval(() => {
      api.workspace(enrollment.id)
        .then((updated) => { if (active) setWorkspace(updated); })
        .catch(async (caught) => {
          if (!active || !(caught instanceof ApiError) || caught.status !== 404) return;
          try {
            const created = await api.createWorkspace(enrollment.id);
            if (active) setWorkspace(created);
          } catch {
            // 清理结束后重试创建。
          }
        });
    }, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [enrollment, workspace?.status]);

  // 与 V1 一致：运行中每 60 秒发心跳（仅页面可见且有焦点时），关标签页时 sendBeacon 立即停 VM。
  // 没有心跳的话，服务端会在空闲 15 分钟后把仍开着页面的学员的 VM 停掉。
  useEffect(() => {
    if (!enrollmentId || workspace?.status !== "RUNNING") return;
    const interval = window.setInterval(() => {
      if (!isHeartbeatDue(workspace.status, document.visibilityState === "visible", document.hasFocus())) return;
      void api.workspaceHeartbeat(enrollmentId).catch(() => undefined);
    }, heartbeatIntervalMs);
    function stopOnClose() {
      beaconStopWorkspace(enrollmentId!, getAccessToken());
    }
    window.addEventListener("pagehide", stopOnClose);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", stopOnClose);
    };
  }, [enrollmentId, workspace?.status]);

  useEffect(() => {
    const keepFloatingButtonInView = () => window.dispatchEvent(new Event("aivirteach-storage-change"));
    window.addEventListener("resize", keepFloatingButtonInView);
    return () => {
      window.removeEventListener("resize", keepFloatingButtonInView);
    };
  }, []);

  useEffect(() => {
    if (floatingPromptOpen) floatingPromptRef.current?.focus();
  }, [floatingPromptOpen]);

  useLayoutEffect(() => {
    const prompt = floatingPromptRef.current;
    if (!prompt) return;
    prompt.style.height = "auto";
    prompt.style.height = `${prompt.scrollHeight}px`;
  }, [floatingPrompt, floatingPromptOpen]);

  useEffect(() => {
    if (activeTab !== "teacher") return;
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [activeTab, messages, tutorDraft]);

  useEffect(() => {
    let active = true;
    let measuring = false;
    async function measureLatency() {
      if (measuring) return;
      measuring = true;
      const startedAt = performance.now();
      try {
        await api.health();
        if (active) setLatency(Math.max(1, Math.round(performance.now() - startedAt)));
      } catch {
        if (active) setLatency(null);
      } finally {
        measuring = false;
      }
    }
    void measureLatency();
    const interval = window.setInterval(() => void measureLatency(), 500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (layout !== "split" || event.button !== 0) return;
    event.preventDefault();
    const shell = shellRef.current;
    if (!shell) return;
    const shellWidth = shell.getBoundingClientRect().width;
    const startX = event.clientX;
    const startWidth = leftWidth;
    let nextWidth = leftWidth;
    let latestX = event.clientX;
    let animationFrame: number | null = null;
    shell.classList.add("is-resizing");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function applyResize() {
      animationFrame = null;
      nextWidth = Math.min(shellWidth - minVmWidth, Math.max(minLeftWidth, startWidth + latestX - startX));
      shell!.style.setProperty("--lab-v2-left-width", `${nextWidth}px`);
    }

    function resize(moveEvent: PointerEvent) {
      latestX = moveEvent.clientX;
      if (animationFrame === null) animationFrame = window.requestAnimationFrame(applyResize);
    }

    function stop() {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        applyResize();
      }
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      shell!.classList.remove("is-resizing");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setLeftWidth(nextWidth);
      window.localStorage.setItem(widthStorageKey, String(nextWidth));
    }
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  function resizeWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const shellWidth = shellRef.current?.getBoundingClientRect().width ?? window.innerWidth;
    setLeftWidth((current) => {
      const next = Math.min(shellWidth - minVmWidth, Math.max(minLeftWidth, current + (event.key === "ArrowRight" ? 24 : -24)));
      window.localStorage.setItem(widthStorageKey, String(next));
      return next;
    });
  }

  async function refreshConversation() {
    if (!currentTutorDisplay || currentTutorDisplay.kind === "active" || currentTutorDisplay.refresh === "loading") return;
    const refreshing = { ...currentTutorDisplay, refresh: "loading" as const };
    setTutorDisplay(refreshing);
    const loaded = await loadMessages();
    setTutorDisplay((current) => current === refreshing ? { ...current, refresh: loaded ? "loaded" : "failed" } : current);
  }

  async function requestTutorResponse(text: string, notifyWhenReady: boolean) {
    if (!enrollment || !chatContext) return;
    const request = chat.begin();
    if (!request) return;
    const floatingOwnerId = notifyWhenReady ? crypto.randomUUID() : null;
    if (floatingOwnerId) setFloatingOwner({ id: floatingOwnerId, contextKey: chatKey });
    appendMessage({ role: "student", text });
    try {
      setTutorDisplay({ kind: "active", key: chatKey, reply: initialTutorReply });
      const response = await api.streamChatMessage(enrollment.id, { requestId: crypto.randomUUID(), text, context: chatContext }, request.signal);
      const tutorText = await readTutorStream(response, {
        signal: request.signal,
        onState(reply) { if (request.isCurrent()) setTutorDisplay({ kind: "active", key: chatKey, reply }); },
      });
      if (request.isCurrent()) { appendMessage({ role: "tutor", text: tutorText }); setTutorDisplay(null); }
    } catch (caught) {
      if (request.isCurrent()) setTutorDisplay({ kind: "failed", key: chatKey, refresh: "idle", message: caught instanceof TutorReplyNotSavedError ? t("The reply could not be confirmed as saved. Refresh the conversation to check before asking again.", "回复未能确认保存。再次提问前，请刷新对话确认结果。") : upstreamErrorMessage(caught, { retryable: t("The reply could not be confirmed. Refresh the conversation to check before trying again.", "暂时无法确认回复结果。重试前，请刷新对话确认。"), unavailable: t("The tutor is unavailable. Please contact support.", "助教服务暂时不可用，请联系客服。") }) });
    } finally {
      const isCurrent = request.isCurrent();
      request.finish();
      if (floatingOwnerId) {
        setFloatingOwner((current) => current?.id === floatingOwnerId ? null : current);
        if (isCurrent) setFloatingUnreadKey(chatKey);
      }
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment || !chatContext || chat.busy || !message.trim()) return;
    const text = message.trim();
    setMessage("");
    await requestTutorResponse(text, false);
  }

  function sendFloatingPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment || !chatContext || chat.busy || floatingThinking || !floatingPrompt.trim()) return;
    const text = floatingPrompt.trim();
    setFloatingPrompt("");
    setFloatingPromptOpen(false);
    setFloatingUnreadKey(null);
    setActiveTab("teacher");
    setLayout((current) => current === "minimized" ? "split" : current);
    void requestTutorResponse(text, true);
  }

  function handleFloatingPromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function handleFloatingButtonClick() {
    if (floatingWasDraggedRef.current) {
      floatingWasDraggedRef.current = false;
      return;
    }
    if (floatingUnread || chat.busy) {
      setActiveTab("teacher");
      setLayout((current) => current === "minimized" ? "split" : current);
      setFloatingUnreadKey(null);
      setFloatingPromptOpen(false);
      return;
    }
    if (!floatingThinking) {
      setFloatingPromptOpen((current) => {
        if (!current) setSavedFloatingPosition((position) => ({ ...position, x: Math.max(floatingPromptMinX(), position.x) }));
        return !current;
      });
    }
  }

  function startFloatingDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const startPosition = floatingPosition;
    let latestPosition = startPosition;
    floatingWasDraggedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);

    function move(moveEvent: PointerEvent) {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      if (Math.abs(deltaX) + Math.abs(deltaY) > 5) floatingWasDraggedRef.current = true;
      latestPosition = {
        x: Math.min(window.innerWidth - floatingButtonSize - floatingViewportMargin, Math.max(floatingPromptOpen ? floatingPromptMinX() : floatingViewportMargin, startPosition.x + deltaX)),
        y: Math.min(window.innerHeight - floatingButtonSize - floatingViewportMargin, Math.max(floatingViewportMargin, startPosition.y + deltaY)),
      };
      setDraggedFloatingPosition(latestPosition);
    }

    function stop() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      setSavedFloatingPosition(latestPosition);
      setDraggedFloatingPosition(null);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  const startConsoleSession = consoleState.start;

  function retryWorkspace() {
    if (!enrollment || retrying) return;
    setRetrying(true);
    api.createWorkspace(enrollment.id).then(setWorkspace).catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Could not restart the workspace.");
    }).finally(() => setRetrying(false));
  }

  function resumeWorkspace() {
    if (!enrollment || resuming) return;
    setResuming(true);
    setResumeError("");
    api.startWorkspace(enrollment.id).then(setWorkspace).catch((caught) => {
      setResumeError(upstreamErrorMessage(caught, {
        retryable: t("The learning environment is unreachable right now. Please try again later.", "学习环境暂时连接不上，请稍后重试。"),
        unavailable: t("The learning environment is unavailable. Please try again later or contact support.", "学习环境暂时无法使用，请稍后再试或联系客服。"),
      }));
    }).finally(() => setResuming(false));
  }

  function closeEnvironment() {
    if (!enrollment || stopping) return;
    if (!window.confirm(t("Close the learning environment? You can resume it anytime.", "要关闭学习环境吗？你可以随时恢复。"))) return;
    setStopping(true);
    setError("");
    consoleState.stop();
    api.stopWorkspace(enrollment.id).then((stoppedWorkspace) => {
      setWorkspace(stoppedWorkspace);
    }).catch((caught) => {
      setError(upstreamErrorMessage(caught, {
        retryable: t("The learning environment is unreachable right now. Please try again later.", "学习环境暂时连接不上，请稍后重试。"),
        unavailable: t("The learning environment is unavailable. Please try again later or contact support.", "学习环境暂时无法使用，请稍后再试或联系客服。"),
      }));
    }).finally(() => setStopping(false));
  }

  // V2 没有心跳，空闲 15 分钟后服务端会停掉 VM，但页面不会被通知；控制台出错时重新拉一次状态，
  // 让面板能切到"已关闭"。拉取失败就保持原样，不覆盖已有的控制台错误提示。
  const handleConsoleError = consoleState.reportViewerError;

  const copyLessonCodeToVm = useCallback((text: string) => {
    return consoleViewerRef.current?.writeClipboard(text) ?? false;
  }, []);

  if (!checked || !course || !enrollment) {
    return <main className="lab-v2-gate" role="status"><BrandLogo /><h1>{checked ? t("Choose a course first", "请先选择课程") : t("Opening Learning Lab V2...", "正在打开学习实验室 V2……")}</h1><p>{error || (checked ? t("Choose a course before opening its workspace.", "请先选择课程，再打开其工作区。") : t("Loading your course.", "正在加载课程。"))}</p>{checked && <Button type="button" onClick={() => router.replace("/courses")}>{t("Browse courses", "浏览课程")}</Button>}</main>;
  }

  const frameStyle = { "--lab-v2-left-width": `${leftWidth}px` } as CSSProperties;
  const panel = vmPanelState(workspace?.status, consoleSession?.state === "ready" && Boolean(consoleSession.data));

  return (
    <div ref={shellRef} className={`lab-v2-shell ${layout === "maximized" ? "left-maximized" : layout === "minimized" ? "left-minimized" : ""}`} style={frameStyle}>
      <section className="lab-v2-left" aria-label={t("Learning workspace", "学习工作区")}>
        <header className="lab-v2-header">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button className="lab-v2-logo-trigger" variant="ghost" size="icon" type="button" aria-label={t("Open Learning Lab menu", "打开学习实验室菜单")} />}>
              <BrandLogo className="lab-v2-logo" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="lab-v2-workspace-menu" align="start" side="bottom" sideOffset={8}>
              <div className="lab-v2-menu-label">{t("Language", "语言")}</div>
              <DropdownMenuItem onClick={() => applyLearningLanguage("en")} aria-current={learningLanguage === "en" ? "true" : undefined}>{learningLanguage === "en" && <Check aria-hidden="true" />}<span>English</span></DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyLearningLanguage("zh-CN")} aria-current={learningLanguage === "zh-CN" ? "true" : undefined}>{learningLanguage === "zh-CN" && <Check aria-hidden="true" />}<span>简体中文</span></DropdownMenuItem>
              <div className="lab-v2-menu-separator" />
              <DropdownMenuItem variant="destructive" onClick={() => router.push("/dashboard")}>{t("Exit", "退出")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEnvVariablesOpen(true)}>{t("Env Variables", "环境变量")}</DropdownMenuItem>
              <DropdownMenuItem disabled>{t("Settings", "设置")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="lab-v2-tabs" role="tablist" aria-label={t("Learning workspace views", "学习工作区视图")}>
            <Button variant="ghost" type="button" role="tab" aria-selected={activeTab === "teacher"} onClick={() => setActiveTab("teacher")}>AIVirTeach</Button>
            <Button variant="ghost" type="button" role="tab" aria-selected={activeTab === "path"} onClick={() => setActiveTab("path")}>{t("Learning Path", "学习路径")}</Button>
          </div>
          <div className="lab-v2-window-actions">
            <Button className="lab-v2-minimize" variant="ghost" size="icon" type="button" onClick={() => setLayout("minimized")} aria-label={t("Minimize learning panel", "收起学习面板")} title={t("Minimize learning panel", "收起学习面板")}><span aria-hidden="true">&lt;</span></Button>
            <Button className="lab-v2-expand" variant="ghost" size="icon" type="button" onClick={() => setLayout((current) => current === "maximized" ? "split" : "maximized")} aria-label={layout === "maximized" ? t("Restore split workspace", "恢复分屏工作区") : t("Maximize learning workspace", "最大化学习工作区")} aria-pressed={layout === "maximized"} title={layout === "maximized" ? t("Restore split workspace", "恢复分屏工作区") : t("Maximize learning workspace", "最大化学习工作区")}>
              {layout === "maximized" ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
            </Button>
          </div>
        </header>

        {activeTab === "teacher" ? (
          <div className="lab-v2-teacher" role="tabpanel">
            <header><div className="tutor-heading"><span className="bot-mark">AI</span><div><strong>AIVir Teacher</strong><small><i /> {t("Online", "在线")}</small></div></div><p>{course.title}</p></header>
            <div ref={messagesRef} className="messages">{messages.map((item, index) => <article className={`message ${item.role}`} key={`${item.role}-${index}`}><div>{item.role === "tutor" ? <TutorMessage text={item.text} /> : <p>{item.text}</p>}<small>{index === messages.length - 1 ? t("Just now", "刚刚") : t("Earlier", "较早")}</small></div></article>)}{pendingReply && <article className="message tutor pending"><div><p role="status">{tutorReplyStatus(pendingReply, t)}</p>{tutorDraft && <TutorMessage text={tutorDraft} />}</div></article>}{currentTutorDisplay?.kind === "failed" && <p role="alert">{currentTutorDisplay.message}</p>}{currentTutorDisplay?.kind === "interrupted" && <p role="status">{t("Stopped receiving this reply. The tutor may continue and save it. Refresh the conversation to check; if the reply is not ready, check again later.", "已停止接收本次回复。后台可能继续处理并保存，请刷新对话查看；若回复尚未保存，请稍后再查看。")}</p>}</div>
            {(currentTutorDisplay?.kind === "interrupted" || currentTutorDisplay?.kind === "failed") && <div>
              <Button variant="outline" type="button" disabled={currentTutorDisplay.refresh === "loading"} onClick={() => void refreshConversation()}>{currentTutorDisplay.refresh === "loading" ? t("Refreshing...", "正在刷新……") : t("Refresh conversation", "刷新对话")}</Button>
              {currentTutorDisplay.refresh === "loaded" && <p role="status">{t("Conversation refreshed. If the reply is not ready, check again later.", "对话已刷新。若回复尚未保存，请稍后再查看。")}</p>}
              {currentTutorDisplay.refresh === "failed" && <p role="alert">{t("Could not refresh the conversation. Please try again.", "对话刷新失败，请重试。")}</p>}
            </div>}
            {chat.busy && <Button variant="outline" type="button" onClick={() => { chat.cancel(); setTutorDisplay({ kind: "interrupted", key: chatKey, refresh: "idle" }); setFloatingOwner(null); }}>{t("Stop receiving", "停止接收")}</Button>}
            {tutorVersionMismatch && <Alert variant="destructive">{t("This lesson does not match the active course version. Reload the course before asking the tutor.", "当前课时与课程版本不匹配，请刷新课程后再向教师提问。")}<Button variant="outline" type="button" onClick={() => window.location.reload()}>{t("Reload course", "刷新课程")}</Button></Alert>}
            <form className="message-form" onSubmit={sendMessage}><Input value={message} onChange={(event) => setMessage(event.target.value)} aria-label={t("Ask AIVir Teacher", "向 AIVir Teacher 提问")} placeholder={t("Ask about this course step...", "询问此课程步骤……")} disabled={!chatContext || chat.busy} /><Button type="submit" disabled={!chatContext || chat.busy}>{chat.busy ? t("Sending...", "发送中……") : t("Send", "发送")}</Button></form>
          </div>
        ) : (
          <div className="lab-v2-path" role="tabpanel">
            {error && <Alert variant="destructive">{error}</Alert>}
            <CourseLearningPath key={course.id} course={course} copyToVm={copyLessonCodeToVm} session={learningSession} />
          </div>
        )}
      </section>

      {layout === "split" && <div className="lab-v2-resizer" role="separator" aria-label={t("Resize learning workspace", "调整学习工作区大小")} aria-orientation="vertical" aria-valuemin={minLeftWidth} aria-valuenow={leftWidth} tabIndex={0} onPointerDown={startResize} onKeyDown={resizeWithKeyboard} />}

      <main className="lab-v2-vm vm-workspace">
        {layout === "minimized" && <Button className="lab-v2-restore" variant="outline" size="icon" type="button" onClick={() => setLayout("split")} aria-label={t("Restore learning panel", "恢复学习面板")} title={t("Restore learning panel", "恢复学习面板")}><span aria-hidden="true">&gt;</span></Button>}
        <header className="vm-toolbar"><div><span className="vm-status-dot" aria-hidden="true" /><strong>{t("Learning VM", "学习虚拟机")}</strong></div><div className="lab-v2-vm-status"><small>{workspace?.status === "RUNNING" && consoleSession ? t("Connected workspace", "工作区已连接") : t("Awaiting connection", "等待连接")}</small><span className={`lab-v2-latency ${latency === null ? "is-offline" : ""}`} role="img" aria-label={latency === null ? t("Server connection unavailable", "服务器连接不可用") : t(`Server latency ${latency} milliseconds`, `服务器延迟 ${latency} 毫秒`)} title={latency === null ? t("Server connection unavailable", "服务器连接不可用") : `${latency} ms`}>{latency === null ? <WifiOff aria-hidden="true" /> : <Wifi aria-hidden="true" />}</span>{workspace?.status === "RUNNING" && <Button type="button" variant="destructive" size="xs" className="vm-close-button" onClick={closeEnvironment} disabled={stopping}>{stopping ? t("Closing...", "正在关闭……") : t("Close environment", "关闭环境")}</Button>}</div></header>
        {panel === "console" && consoleSession?.data ? <ConsoleViewer ref={consoleViewerRef} data={consoleSession.data} labId={consoleSession.labId} enrollmentId={enrollment.id} onError={handleConsoleError} /> : panel === "start-console" ? <section className="vm-empty-state" role="status"><span className="vm-display-icon" aria-hidden="true" /><h2>Learning VM</h2>{consoleError && <Alert className="auth-error" variant="destructive">{consoleError}</Alert>}<Button size="lg" type="button" onClick={() => void startConsoleSession()} disabled={consoleLoading || stopping}>{consoleLoading ? "Starting..." : "Start remote desktop"}</Button></section> : panel === "stopped" ? <section className="vm-empty-state" role="status"><span className="vm-display-icon" aria-hidden="true" /><h2>Learning VM</h2><p>Your Learning VM is closed. Resume it to keep working.</p>{resumeError && <Alert className="auth-error" variant="destructive">{resumeError}</Alert>}<Button size="lg" type="button" onClick={resumeWorkspace} disabled={resuming}>{resuming ? "Resuming..." : "Resume learning environment"}</Button></section> : panel === "error" ? <section className="vm-empty-state" role="status"><span className="vm-display-icon" aria-hidden="true" /><h2>Learning VM</h2><p>{workspace?.errorMessage || "Could not start your Learning VM."}</p><Button size="lg" type="button" onClick={retryWorkspace} disabled={retrying}>{retrying ? "Retrying..." : "Retry"}</Button></section> : <section className="vm-empty-state" role="status"><span className="vm-display-icon" aria-hidden="true" /><h2>Learning VM</h2><p>{workspace?.status === "RESETTING" ? t("Clearing the previous Learning VM. This can take a few minutes.", "正在清理之前的学习虚拟机，可能需要几分钟。") : t("Preparing your Learning VM. This can take a few minutes.", "正在准备学习虚拟机，可能需要几分钟。")}</p></section>}
      </main>

      <Dialog open={envVariablesOpen} onOpenChange={setEnvVariablesOpen}>
        <DialogContent className="lab-v2-env-dialog">
          <DialogHeader>
            <DialogTitle>{t("Environment variables", "环境变量")}</DialogTitle>
            <DialogDescription>{t(`Requirements available in the Learning VM for ${course.title}.`, `${course.title} 的学习虚拟机中可用的要求。`)}</DialogDescription>
          </DialogHeader>
          <ul className="lab-v2-env-list">
            {course.requirements.map((requirement) => <li key={requirement}><span aria-hidden="true">✓</span><strong>{requirement}</strong></li>)}
          </ul>
          <DialogFooter><Button type="button" onClick={() => setEnvVariablesOpen(false)}>{t("Done", "完成")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="floating-ai" style={{ left: floatingPosition.x, top: floatingPosition.y }}>
        {floatingPromptOpen && (
          <form className={`floating-ai-prompt ${floatingPosition.y < 130 ? "expand-down" : ""}`} onSubmit={sendFloatingPrompt}>
            <textarea ref={floatingPromptRef} rows={1} value={floatingPrompt} onChange={(event) => setFloatingPrompt(event.target.value)} onKeyDown={handleFloatingPromptKeyDown} placeholder={t("\u00A0\u00A0Ask AIVirTeach...", "\u00A0\u00A0向 AIVirTeach 提问……")} aria-label={t("Ask AIVirTeach", "向 AIVirTeach 提问")} disabled={!chatContext || chat.busy} />
            <Button variant="ghost" size="icon" type="submit" disabled={!floatingPrompt.trim() || !chatContext || chat.busy} aria-label={t("Send prompt", "发送问题")}><Send aria-hidden="true" /></Button>
          </form>
        )}
        <button className={`floating-ai-button ${floatingThinking ? "thinking" : ""}`} type="button" onPointerDown={startFloatingDrag} onClick={handleFloatingButtonClick} aria-label={floatingUnread ? t("Open new AIVirTeach response", "打开 AIVirTeach 的新回复") : floatingThinking ? t("AIVirTeach is replying", "AIVirTeach 正在回复") : t("Ask AIVirTeach", "向 AIVirTeach 提问")} aria-expanded={floatingPromptOpen}>
          {/* A plain static asset avoids Vinext's unsupported Next image-optimization path. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {floatingThinking ? <span className="floating-ai-typing" aria-hidden="true"><i /><i /><i /></span> : <img src="/logo-only.png" alt="" aria-hidden="true" />}
          {floatingUnread && <span className="floating-ai-notification" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

function tutorReplyStatus(state: TutorReplyState, t: (en: string, zh: string) => string): string {
  switch (state.kind) {
    case "diagnosing": return state.activity === "tools" ? t("Checking the learning environment...", "正在检查学习环境……") : state.activity === "validating" ? t("Reviewing the diagnostic evidence...", "正在核对诊断依据……") : t("Checking your question...", "正在分析问题……");
    case "answering": return t("Writing a reply...", "正在生成回复……");
    case "fallback": return state.reason === "assessment" ? t("The diagnostic result could not be verified. Waiting for a safe response...", "诊断结果未通过校验，正在等待处理结果……") : t("The detailed reply was interrupted. Preparing a diagnostic summary...", "详细回复生成中断，正在准备诊断摘要……");
    case "awaiting": return t("Waiting for confirmation...", "正在等待回复确认……");
    case "saving": return t("Saving the reply...", "正在保存回复……");
    case "completed": return t("Reply saved.", "回复已保存。");
  }
}
