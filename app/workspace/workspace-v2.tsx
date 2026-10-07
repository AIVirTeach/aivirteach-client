"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent, type SyntheticEvent, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Maximize2, Minimize2, Send } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "../components/BrandLogo";
import { api, ApiError, courseDesignUrl, type ApiConsoleSession, type ApiCourseDesignPackage, type ApiCourseDetail, type ApiEnrollment, type ApiWorkspace } from "../lib/api";
import { applyLearningLanguage, courseDesignMatchesLanguage, localize, useLearningLanguage } from "../lib/language";
import { getServerScrollbarPreference, getStoredScrollbarPreference, subscribeToScrollbarPreference, type ScrollbarPreference } from "../lib/scrollbar-preference";
import { ConsoleViewer, type ConsoleViewerHandle } from "./console-viewer";
import { upstreamErrorMessage } from "./upstream-error";
import { vmPanelState } from "./vm-panel-state";

type Message = { role: "tutor" | "student"; text: string };
type WorkspaceTab = "teacher" | "path";

const initialMessages: Message[] = [
  { role: "tutor", text: "I am ready to help with this course. Tell me what you are trying to do or where the result differs from the learning path." },
];
const widthStorageKey = "aivirteach.lab.v2.leftWidth";
const themeStorageKey = "aivirteach.lab.v2.aiDailyBriefingTheme";
const floatingPositionStorageKey = "aivirteach.lab.v2.floatingAiPosition";
const minLeftWidth = 380;
const minVmWidth = 420;
const floatingButtonSize = 64;
const floatingViewportMargin = 14;
const floatingPromptGap = 12;
const floatingPromptMaxWidth = 340;
const courseCopySelector = ".copy-btn, .step-copy-btn, .inline-copy-link[data-copy-text]";

type CourseFrameClipboardBridge = {
  copyToVm: (text: string) => boolean;
  language: "en" | "zh-CN";
};

const courseFrameClipboardBridges = new WeakMap<Document, CourseFrameClipboardBridge>();

function floatingPromptWidth() {
  return Math.min(floatingPromptMaxWidth, window.innerWidth - (floatingViewportMargin * 2) - floatingButtonSize - floatingPromptGap);
}

function floatingPromptMinX() {
  return floatingViewportMargin + Math.max(0, floatingPromptWidth()) + floatingPromptGap;
}

function lessonCodeForButton(button: HTMLElement): string {
  if (button.dataset.copyText) return button.dataset.copyText;
  const directCode = button.closest("pre")?.querySelector<HTMLElement>("code");
  if (button.classList.contains("step-copy-btn") && directCode) {
    return directCode.dataset.rawCode ?? directCode.textContent ?? "";
  }
  const block = button.closest(".code-wrap");
  if (block) {
    return [...block.querySelectorAll<HTMLElement>("pre code")]
      .filter((code) => code.closest(".code-wrap") === block)
      .map((code) => code.dataset.rawCode ?? code.textContent ?? "")
      .join("\n\n");
  }
  return directCode?.dataset.rawCode ?? directCode?.textContent ?? "";
}

function prepareCourseFrame(
  event: SyntheticEvent<HTMLIFrameElement>,
  preference: ScrollbarPreference,
  language: "en" | "zh-CN",
  copyToVm: (text: string) => boolean,
) {
  const document = event.currentTarget.contentDocument;
  if (!document?.head) return;
  let style = document.getElementById("aivirteach-scrollbars") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "aivirteach-scrollbars";
    document.head.append(style);
  }
  style.textContent = preference === "hidden" ? `
    * { scrollbar-width: none; }
    *::-webkit-scrollbar { display: none; width: 0; height: 0; }
  ` : `
    * { scrollbar-width: thin; scrollbar-color: rgba(100, 116, 139, .72) rgba(15, 23, 42, .06); }
    *::-webkit-scrollbar { width: 10px; height: 10px; }
    *::-webkit-scrollbar-track { background: rgba(15, 23, 42, .06); }
    *::-webkit-scrollbar-thumb { min-height: 36px; border: 2px solid transparent; border-radius: 999px; background: rgba(100, 116, 139, .72); background-clip: padding-box; }
    *::-webkit-scrollbar-thumb:hover { background: rgba(71, 85, 105, .9); background-clip: padding-box; }
    *::-webkit-scrollbar-corner { background: transparent; }
  `;

  let clipboardBridge = courseFrameClipboardBridges.get(document);
  if (!clipboardBridge) {
    clipboardBridge = { copyToVm, language };
    courseFrameClipboardBridges.set(document, clipboardBridge);
    document.addEventListener("click", (clickEvent) => {
      const target = clickEvent.target as Element | null;
      const copyButton = typeof target?.closest === "function"
        ? target.closest<HTMLElement>(courseCopySelector)
        : null;
      if (!copyButton) return;
      const code = lessonCodeForButton(copyButton);
      if (code) courseFrameClipboardBridges.get(document)?.copyToVm(code);
    }, true);
  } else {
    clipboardBridge.copyToVm = copyToVm;
    clipboardBridge.language = language;
  }

  const annotateCopyButtons = () => {
    const bridge = courseFrameClipboardBridges.get(document);
    if (!bridge) return;
    document.querySelectorAll<HTMLElement>(courseCopySelector).forEach((copyButton) => {
      copyButton.dataset.vmClipboardBridge = "true";
      copyButton.title = bridge.language === "zh-CN"
        ? "同时复制到已连接的虚拟机剪贴板"
        : "Also copies to the connected VM clipboard";
    });
  };
  annotateCopyButtons();
  if (document.body && document.body.dataset.vmClipboardObserver !== "true") {
    document.body.dataset.vmClipboardObserver = "true";
    const observer = new MutationObserver(annotateCopyButtons);
    observer.observe(document.body, { childList: true, subtree: true });
    document.defaultView?.addEventListener("unload", () => observer.disconnect(), { once: true });
  }
}

export function WorkspaceV2() {
  const router = useRouter();
  const learningLanguage = useLearningLanguage();
  const t = (english: string, chinese: string) => localize(learningLanguage, english, chinese);
  const scrollbarPreference = useSyncExternalStore(subscribeToScrollbarPreference, getStoredScrollbarPreference, getServerScrollbarPreference);
  const shellRef = useRef<HTMLDivElement>(null);
  const floatingPromptRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const consoleViewerRef = useRef<ConsoleViewerHandle>(null);
  const floatingWasDraggedRef = useRef(false);
  const consolePollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consolePollCancelled = useRef(false);
  const [course, setCourse] = useState<ApiCourseDetail | null>(null);
  const [enrollment, setEnrollment] = useState<ApiEnrollment | null>(null);
  const enrollmentId = enrollment?.id;
  const [workspace, setWorkspace] = useState<ApiWorkspace | null>(null);
  const [designPackage, setDesignPackage] = useState<ApiCourseDesignPackage | null>(null);
  const [selectedDesignId, setSelectedDesignId] = useState("");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("path");
  const [leftWidth, setLeftWidth] = useState(680);
  const [maximized, setMaximized] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [message, setMessage] = useState("");
  const [consoleSession, setConsoleSession] = useState<ApiConsoleSession | null>(null);
  const [consoleError, setConsoleError] = useState("");
  const [consoleLoading, setConsoleLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const [latency, setLatency] = useState<number | null>(null);
  const [envVariablesOpen, setEnvVariablesOpen] = useState(false);
  const [floatingPromptOpen, setFloatingPromptOpen] = useState(false);
  const [floatingPrompt, setFloatingPrompt] = useState("");
  const [floatingThinking, setFloatingThinking] = useState(false);
  const [floatingUnread, setFloatingUnread] = useState(false);
  const [floatingPosition, setFloatingPosition] = useState({ x: -100, y: -100 });

  useEffect(() => {
    let active = true;
    Promise.all([api.enrollments(), api.courseDesigns()]).then(async ([enrollments, localDesignPackage]) => {
      const current = enrollments.find((item) => item.active);
      if (!current) return;
      const courseData = await api.course(current.courseId);
      if (!active) return;
      setEnrollment(current);
      setCourse(courseData);
      setDesignPackage(localDesignPackage);
      const storedTheme = window.localStorage.getItem(themeStorageKey);
      const initialTheme = localDesignPackage.themes.find((theme) => theme.id === storedTheme) ?? localDesignPackage.themes[0];
      setSelectedDesignId(initialTheme?.id ?? "");
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
    if (!enrollment || workspace?.status !== "CREATING") return;
    const timer = window.setInterval(() => {
      api.workspace(enrollment.id).then(setWorkspace).catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [enrollment, workspace?.status]);

  useEffect(() => {
    if (!enrollment) return;
    api.chatMessages(enrollment.id).then((items) => {
      if (items.length) setMessages(items.map((item) => ({ role: item.role, text: item.text })));
    }).catch(() => undefined);
  }, [enrollment]);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(widthStorageKey));
    if (Number.isFinite(saved)) setLeftWidth(Math.max(minLeftWidth, saved));

    const clampPosition = (position: { x: number; y: number }) => ({
      x: Math.min(window.innerWidth - floatingButtonSize - floatingViewportMargin, Math.max(floatingViewportMargin, position.x)),
      y: Math.min(window.innerHeight - floatingButtonSize - floatingViewportMargin, Math.max(floatingViewportMargin, position.y)),
    });
    let initialPosition = { x: window.innerWidth - floatingButtonSize - 28, y: window.innerHeight - floatingButtonSize - 28 };
    try {
      const savedPosition = JSON.parse(window.localStorage.getItem(floatingPositionStorageKey) ?? "null") as { x?: unknown; y?: unknown } | null;
      if (typeof savedPosition?.x === "number" && typeof savedPosition.y === "number") initialPosition = { x: savedPosition.x, y: savedPosition.y };
    } catch {
      // Ignore a malformed saved position and use the default.
    }
    setFloatingPosition(clampPosition(initialPosition));
    const keepFloatingButtonInView = () => setFloatingPosition((current) => clampPosition(current));
    window.addEventListener("resize", keepFloatingButtonInView);
    return () => {
      window.removeEventListener("resize", keepFloatingButtonInView);
      consolePollCancelled.current = true;
      if (consolePollTimer.current) clearTimeout(consolePollTimer.current);
    };
  }, []);

  useEffect(() => {
    if (floatingPromptOpen) floatingPromptRef.current?.focus();
  }, [floatingPromptOpen]);

  useEffect(() => {
    if (activeTab !== "teacher") return;
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [activeTab, messages]);

  useEffect(() => {
    if (workspace?.status === "RUNNING") return;
    consolePollCancelled.current = true;
    setConsoleSession(null);
    setConsoleLoading(false);
  }, [workspace?.status]);

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
    if (maximized || event.button !== 0) return;
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

  async function requestTutorResponse(text: string, notifyWhenReady: boolean) {
    if (!enrollment) return;
    setMessages((current) => [...current, { role: "student", text }]);
    if (notifyWhenReady) setFloatingThinking(true);
    try {
      const response = await api.sendChatMessage(enrollment.id, text);
      setMessages((current) => [...current, { role: "tutor", text: response.tutorMessage.text }]);
    } catch (caught) {
      setMessages((current) => [...current, { role: "tutor", text: caught instanceof Error ? caught.message : "The tutor is unavailable." }]);
    } finally {
      if (notifyWhenReady) {
        setFloatingThinking(false);
        setFloatingUnread(true);
      }
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment || !message.trim()) return;
    const text = message.trim();
    setMessage("");
    await requestTutorResponse(text, false);
  }

  function sendFloatingPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment || floatingThinking || !floatingPrompt.trim()) return;
    const text = floatingPrompt.trim();
    setFloatingPrompt("");
    setFloatingPromptOpen(false);
    setFloatingUnread(false);
    void requestTutorResponse(text, true);
  }

  function handleFloatingButtonClick() {
    if (floatingWasDraggedRef.current) {
      floatingWasDraggedRef.current = false;
      return;
    }
    if (floatingUnread) {
      setActiveTab("teacher");
      setFloatingUnread(false);
      setFloatingPromptOpen(false);
      return;
    }
    if (!floatingThinking) {
      setFloatingPromptOpen((current) => {
        if (!current) setFloatingPosition((position) => ({ ...position, x: Math.max(floatingPromptMinX(), position.x) }));
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
      setFloatingPosition(latestPosition);
    }

    function stop() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.localStorage.setItem(floatingPositionStorageKey, JSON.stringify(latestPosition));
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  async function startConsoleSession() {
    if (!enrollment) return;
    if (consolePollTimer.current) clearTimeout(consolePollTimer.current);
    consolePollCancelled.current = false;
    setConsoleLoading(true);
    setConsoleError("");
    const deadline = Date.now() + 120000;
    async function poll() {
      try {
        const session = await api.consoleSession(enrollment!.id);
        if (consolePollCancelled.current) return;
        if (session.state === "ready") {
          setConsoleSession(session);
          setConsoleLoading(false);
          return;
        }
        if (Date.now() >= deadline) {
          setConsoleError("The remote desktop took too long to start. Please retry.");
          setConsoleLoading(false);
          return;
        }
        consolePollTimer.current = setTimeout(() => void poll(), 2500);
      } catch (caught) {
        if (consolePollCancelled.current) return;
        setConsoleError(caught instanceof Error ? caught.message : "Could not start the remote desktop.");
        setConsoleLoading(false);
        refreshWorkspace();
      }
    }
    void poll();
  }

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
    api.stopWorkspace(enrollment.id).then((stoppedWorkspace) => {
      consolePollCancelled.current = true;
      if (consolePollTimer.current) clearTimeout(consolePollTimer.current);
      setConsoleSession(null);
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
  const refreshWorkspace = useCallback(() => {
    if (!enrollmentId) return;
    api.workspace(enrollmentId).then(setWorkspace).catch(() => undefined);
  }, [enrollmentId]);

  const handleConsoleError = useCallback((nextError: string) => {
    setConsoleError(nextError);
    setConsoleSession(null);
    refreshWorkspace();
  }, [refreshWorkspace]);

  const copyLessonCodeToVm = useCallback((text: string) => {
    return consoleViewerRef.current?.writeClipboard(text) ?? false;
  }, []);

  if (!checked || !course || !enrollment) {
    return <main className="lab-v2-gate" role="status"><BrandLogo /><h1>{checked ? t("Choose a course first", "请先选择课程") : t("Opening Learning Lab V2...", "正在打开学习实验室 V2……")}</h1><p>{error || (checked ? t("Choose a course before opening its workspace.", "请先选择课程，再打开其工作区。") : t("Loading your course and new learning path designs.", "正在加载课程和新的学习路径设计。"))}</p>{checked && <Button type="button" onClick={() => router.replace("/courses")}>{t("Browse courses", "浏览课程")}</Button>}</main>;
  }

  const themes = (designPackage?.themes ?? []).filter((theme) => courseDesignMatchesLanguage(theme.id, learningLanguage));
  const selectedDesign = themes.find((theme) => theme.id === selectedDesignId) ?? themes[0];
  const frameStyle = { "--lab-v2-left-width": `${leftWidth}px` } as CSSProperties;
  const panel = vmPanelState(workspace?.status, consoleSession?.state === "ready" && Boolean(consoleSession.data));

  return (
    <div ref={shellRef} className={`lab-v2-shell ${maximized ? "left-maximized" : ""}`} style={frameStyle}>
      <section className="lab-v2-left" aria-label={t("Learning workspace", "学习工作区")}>
        <header className="lab-v2-header">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button className="lab-v2-logo-trigger" variant="ghost" size="icon" type="button" aria-label={t("Open Learning Lab menu", "打开学习实验室菜单")} />}>
              <BrandLogo className="lab-v2-logo" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="lab-v2-workspace-menu" align="start" side="bottom" sideOffset={8}>
              <div className="lab-v2-menu-label">{t("Learning Path theme", "学习路径主题")}</div>
              {themes.map((theme) => <DropdownMenuItem key={theme.id} onClick={() => { setSelectedDesignId(theme.id); window.localStorage.setItem(themeStorageKey, theme.id); }} aria-current={selectedDesign?.id === theme.id ? "page" : undefined}>{selectedDesign?.id === theme.id && <Check aria-hidden="true" />}<span>{theme.label}</span></DropdownMenuItem>)}
              <div className="lab-v2-menu-separator" />
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
            <Button variant={activeTab === "teacher" ? "default" : "ghost"} type="button" role="tab" aria-selected={activeTab === "teacher"} onClick={() => setActiveTab("teacher")}>AIVirTeach</Button>
            <Button variant={activeTab === "path" ? "default" : "ghost"} type="button" role="tab" aria-selected={activeTab === "path"} onClick={() => setActiveTab("path")}>{t("Learning Path", "学习路径")}</Button>
          </div>
          <Button className="lab-v2-expand" variant="outline" size="icon" type="button" onClick={() => setMaximized((current) => !current)} aria-label={maximized ? t("Restore split workspace", "恢复分屏工作区") : t("Maximize learning workspace", "最大化学习工作区")} aria-pressed={maximized} title={maximized ? t("Restore split workspace", "恢复分屏工作区") : t("Maximize learning workspace", "最大化学习工作区")}>
            {maximized ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
          </Button>
        </header>

        {activeTab === "teacher" ? (
          <div className="lab-v2-teacher" role="tabpanel">
            <header><div className="tutor-heading"><span className="bot-mark">AI</span><div><strong>AIVir Teacher</strong><small><i /> {t("Online", "在线")}</small></div></div><p>{course.title}</p></header>
            <div ref={messagesRef} className="messages">{messages.map((item, index) => <article className={`message ${item.role}`} key={`${item.role}-${index}`}><div><p>{item.text}</p><small>{index === messages.length - 1 ? t("Just now", "刚刚") : t("Earlier", "较早")}</small></div></article>)}</div>
            <form className="message-form" onSubmit={sendMessage}><Input value={message} onChange={(event) => setMessage(event.target.value)} aria-label={t("Ask AIVir Teacher", "向 AIVir Teacher 提问")} placeholder={t("Ask about this course...", "询问这门课程……")} /><Button type="submit">{t("Send", "发送")}</Button></form>
          </div>
        ) : (
          <div className="lab-v2-path" role="tabpanel">
            {error && <Alert variant="destructive">{error}</Alert>}
            {selectedDesign ? <iframe className="lab-v2-course-frame" src={courseDesignUrl(selectedDesign)} title={`${course.title} — ${selectedDesign.label}`} onLoad={(event) => prepareCourseFrame(event, scrollbarPreference, learningLanguage, copyLessonCodeToVm)} /> : <div className="lab-v2-path-empty" role="status"><h2>{t("No learning path designs found", "未找到学习路径设计")}</h2><p>{t("No bundled course HTML is available.", "没有可用的内置课程 HTML。")}</p></div>}
          </div>
        )}
      </section>

      {!maximized && <div className="lab-v2-resizer" role="separator" aria-label={t("Resize learning workspace", "调整学习工作区大小")} aria-orientation="vertical" aria-valuemin={minLeftWidth} aria-valuenow={leftWidth} tabIndex={0} onPointerDown={startResize} onKeyDown={resizeWithKeyboard} />}

      <main className="lab-v2-vm vm-workspace">
        <header className="vm-toolbar"><div><span className="vm-status-dot" aria-hidden="true" /><strong>{t("Learning VM", "学习虚拟机")}</strong></div><div className="lab-v2-vm-status"><small>{workspace?.status === "RUNNING" && consoleSession ? t("Connected workspace", "工作区已连接") : t("Awaiting connection", "等待连接")}</small><small className="lab-v2-latency">{latency === null ? t("Ping --", "延迟 --") : t(`Ping ${latency} ms`, `延迟 ${latency} 毫秒`)}</small>{workspace?.status === "RUNNING" && <button type="button" className="vm-close-button" onClick={closeEnvironment} disabled={stopping}>{stopping ? t("Closing...", "正在关闭……") : t("Close environment", "关闭环境")}</button>}</div></header>
        {panel === "console" && consoleSession?.data ? <ConsoleViewer ref={consoleViewerRef} data={consoleSession.data} labId={consoleSession.labId} enrollmentId={enrollment.id} onError={handleConsoleError} /> : panel === "start-console" ? <section className="vm-empty-state" role="status"><span className="vm-display-icon" aria-hidden="true" /><h2>Learning VM</h2>{consoleError && <Alert className="auth-error" variant="destructive">{consoleError}</Alert>}<Button size="lg" type="button" onClick={() => void startConsoleSession()} disabled={consoleLoading}>{consoleLoading ? "Starting..." : "Start remote desktop"}</Button></section> : panel === "stopped" ? <section className="vm-empty-state" role="status"><span className="vm-display-icon" aria-hidden="true" /><h2>Learning VM</h2><p>Your Learning VM is closed. Resume it to keep working.</p>{resumeError && <Alert className="auth-error" variant="destructive">{resumeError}</Alert>}<Button size="lg" type="button" onClick={resumeWorkspace} disabled={resuming}>{resuming ? "Resuming..." : "Resume learning environment"}</Button></section> : panel === "error" ? <section className="vm-empty-state" role="status"><span className="vm-display-icon" aria-hidden="true" /><h2>Learning VM</h2><p>{workspace?.errorMessage || "Could not start your Learning VM."}</p><Button size="lg" type="button" onClick={retryWorkspace} disabled={retrying}>{retrying ? "Retrying..." : "Retry"}</Button></section> : <section className="vm-empty-state" role="status"><span className="vm-display-icon" aria-hidden="true" /><h2>Learning VM</h2><p>Preparing your Learning VM. This can take a few minutes.</p></section>}
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
          <form className="floating-ai-prompt" onSubmit={sendFloatingPrompt}>
            <input ref={floatingPromptRef} value={floatingPrompt} onChange={(event) => setFloatingPrompt(event.target.value)} placeholder={t("Ask AIVirTeach...", "向 AIVirTeach 提问……")} aria-label={t("Ask AIVirTeach", "向 AIVirTeach 提问")} />
            <button type="submit" disabled={!floatingPrompt.trim()} aria-label={t("Send prompt", "发送问题")}><Send aria-hidden="true" /></button>
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
