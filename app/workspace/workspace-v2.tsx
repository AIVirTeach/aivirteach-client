"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type SyntheticEvent, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Maximize2, Minimize2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "../components/BrandLogo";
import { api, ApiError, courseDesignUrl, type ApiConsoleSession, type ApiCourseDesign, type ApiCourseDesignPackage, type ApiCourseDetail, type ApiEnrollment, type ApiWorkspace } from "../lib/api";
import { getServerScrollbarPreference, getStoredScrollbarPreference, subscribeToScrollbarPreference, type ScrollbarPreference } from "../lib/scrollbar-preference";
import { ConsoleViewer } from "./console-viewer";

type Message = { role: "tutor" | "student"; text: string };
type WorkspaceTab = "teacher" | "path";

const initialMessages: Message[] = [
  { role: "tutor", text: "I am ready to help with this course. Tell me what you are trying to do or where the result differs from the learning path." },
];
const widthStorageKey = "aivirteach.lab.v2.leftWidth";
const themeStorageKey = "aivirteach.lab.v2.aiDailyBriefingTheme";
const minLeftWidth = 380;
const minVmWidth = 420;

function styleCourseFrameScrollbars(event: SyntheticEvent<HTMLIFrameElement>, preference: ScrollbarPreference) {
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
}

export function WorkspaceV2() {
  const router = useRouter();
  const scrollbarPreference = useSyncExternalStore(subscribeToScrollbarPreference, getStoredScrollbarPreference, getServerScrollbarPreference);
  const shellRef = useRef<HTMLDivElement>(null);
  const consolePollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consolePollCancelled = useRef(false);
  const [course, setCourse] = useState<ApiCourseDetail | null>(null);
  const [enrollment, setEnrollment] = useState<ApiEnrollment | null>(null);
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
  const [envVariablesOpen, setEnvVariablesOpen] = useState(false);

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
    return () => {
      consolePollCancelled.current = true;
      if (consolePollTimer.current) clearTimeout(consolePollTimer.current);
    };
  }, []);

  useEffect(() => {
    if (workspace?.status === "RUNNING") return;
    consolePollCancelled.current = true;
    setConsoleSession(null);
    setConsoleLoading(false);
  }, [workspace?.status]);

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

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment || !message.trim()) return;
    const text = message.trim();
    setMessage("");
    try {
      const response = await api.sendChatMessage(enrollment.id, text);
      setMessages((current) => [...current, { role: "student", text: response.studentMessage.text }, { role: "tutor", text: response.tutorMessage.text }]);
    } catch (caught) {
      setMessages((current) => [...current, { role: "student", text }, { role: "tutor", text: caught instanceof Error ? caught.message : "The tutor is unavailable." }]);
    }
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

  const handleConsoleError = useCallback((nextError: string) => {
    setConsoleError(nextError);
    setConsoleSession(null);
  }, []);

  if (!checked || !course || !enrollment) {
    return <main className="lab-v2-gate" role="status"><BrandLogo /><h1>{checked ? "Choose a course first" : "Opening Learning Lab V2..."}</h1><p>{error || (checked ? "Choose a course before opening its workspace." : "Loading your course and new learning path designs.")}</p>{checked && <Button type="button" onClick={() => router.replace("/courses")}>Browse courses</Button>}</main>;
  }

  const themes = designPackage?.themes ?? [];
  const selectedDesign = themes.find((theme) => theme.id === selectedDesignId) ?? themes[0];
  const frameStyle = { "--lab-v2-left-width": `${leftWidth}px` } as CSSProperties;

  return (
    <div ref={shellRef} className={`lab-v2-shell ${maximized ? "left-maximized" : ""}`} style={frameStyle}>
      <section className="lab-v2-left" aria-label="Learning workspace">
        <header className="lab-v2-header">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button className="lab-v2-logo-trigger" variant="ghost" size="icon" type="button" aria-label="Open Learning Lab menu" />}>
              <BrandLogo className="lab-v2-logo" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="lab-v2-workspace-menu" align="start" side="bottom" sideOffset={8}>
              <div className="lab-v2-menu-label">Learning Path theme</div>
              {themes.map((theme) => <DropdownMenuItem key={theme.id} onClick={() => { setSelectedDesignId(theme.id); window.localStorage.setItem(themeStorageKey, theme.id); }} aria-current={selectedDesign?.id === theme.id ? "page" : undefined}>{selectedDesign?.id === theme.id && <Check aria-hidden="true" />}<span>{theme.label}</span></DropdownMenuItem>)}
              <div className="lab-v2-menu-separator" />
              <DropdownMenuItem variant="destructive" onClick={() => router.push("/dashboard")}>Exit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEnvVariablesOpen(true)}>Env Variables</DropdownMenuItem>
              <DropdownMenuItem disabled>Settings</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="lab-v2-tabs" role="tablist" aria-label="Learning workspace views">
            <Button variant={activeTab === "teacher" ? "default" : "ghost"} type="button" role="tab" aria-selected={activeTab === "teacher"} onClick={() => setActiveTab("teacher")}>AIVirTeach</Button>
            <Button variant={activeTab === "path" ? "default" : "ghost"} type="button" role="tab" aria-selected={activeTab === "path"} onClick={() => setActiveTab("path")}>Learning Path</Button>
          </div>
          <Button className="lab-v2-expand" variant="outline" size="icon" type="button" onClick={() => setMaximized((current) => !current)} aria-label={maximized ? "Restore split workspace" : "Maximize learning workspace"} aria-pressed={maximized} title={maximized ? "Restore split workspace" : "Maximize learning workspace"}>
            {maximized ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
          </Button>
        </header>

        {activeTab === "teacher" ? (
          <div className="lab-v2-teacher" role="tabpanel">
            <header><div className="tutor-heading"><span className="bot-mark">AI</span><div><strong>AIVir Teacher</strong><small><i /> Online</small></div></div><p>{course.title}</p></header>
            <div className="messages">{messages.map((item, index) => <article className={`message ${item.role}`} key={`${item.role}-${index}`}><div><p>{item.text}</p><small>{index === messages.length - 1 ? "Just now" : "Earlier"}</small></div></article>)}</div>
            <form className="message-form" onSubmit={sendMessage}><Input value={message} onChange={(event) => setMessage(event.target.value)} aria-label="Ask AIVir Teacher" placeholder="Ask about this course..." /><Button type="submit">Send</Button></form>
          </div>
        ) : (
          <div className="lab-v2-path" role="tabpanel">
            {error && <Alert variant="destructive">{error}</Alert>}
            {selectedDesign ? <iframe className="lab-v2-course-frame" src={courseDesignUrl(selectedDesign)} title={`${course.title} — ${selectedDesign.label} learning path`} onLoad={(event) => styleCourseFrameScrollbars(event, scrollbarPreference)} /> : <div className="lab-v2-path-empty" role="status"><h2>No learning path designs found</h2><p>Add HTML documents to course data/new_designs.</p></div>}
          </div>
        )}
      </section>

      {!maximized && <div className="lab-v2-resizer" role="separator" aria-label="Resize learning workspace" aria-orientation="vertical" aria-valuemin={minLeftWidth} aria-valuenow={leftWidth} tabIndex={0} onPointerDown={startResize} onKeyDown={resizeWithKeyboard} />}

      <main className="lab-v2-vm vm-workspace">
        <header className="vm-toolbar"><div><span className="vm-status-dot" aria-hidden="true" /><strong>Learning VM</strong></div><small>{workspace?.status === "RUNNING" && consoleSession ? "Connected workspace" : "Awaiting connection"}</small></header>
        {workspace?.status === "RUNNING" && consoleSession?.state === "ready" && consoleSession.data ? <ConsoleViewer data={consoleSession.data} labId={consoleSession.labId} enrollmentId={enrollment.id} onError={handleConsoleError} /> : workspace?.status === "RUNNING" ? <section className="vm-empty-state" role="status"><span className="vm-display-icon" aria-hidden="true" /><h2>Learning VM</h2>{consoleError && <Alert className="auth-error" variant="destructive">{consoleError}</Alert>}<Button size="lg" type="button" onClick={() => void startConsoleSession()} disabled={consoleLoading}>{consoleLoading ? "Starting..." : "Start remote desktop"}</Button></section> : workspace?.status === "ERROR" ? <section className="vm-empty-state" role="status"><span className="vm-display-icon" aria-hidden="true" /><h2>Learning VM</h2><p>{workspace.errorMessage || "Could not start your Learning VM."}</p><Button size="lg" type="button" onClick={retryWorkspace} disabled={retrying}>{retrying ? "Retrying..." : "Retry"}</Button></section> : <section className="vm-empty-state" role="status"><span className="vm-display-icon" aria-hidden="true" /><h2>Learning VM</h2><p>Preparing your Learning VM. This can take a few minutes.</p></section>}
      </main>

      <Dialog open={envVariablesOpen} onOpenChange={setEnvVariablesOpen}>
        <DialogContent className="lab-v2-env-dialog">
          <DialogHeader>
            <DialogTitle>Environment variables</DialogTitle>
            <DialogDescription>Requirements available in the Learning VM for {course.title}.</DialogDescription>
          </DialogHeader>
          <ul className="lab-v2-env-list">
            {course.requirements.map((requirement) => <li key={requirement}><span aria-hidden="true">✓</span><strong>{requirement}</strong></li>)}
          </ul>
          <DialogFooter><Button type="button" onClick={() => setEnvVariablesOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
