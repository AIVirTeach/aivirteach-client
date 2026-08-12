"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { AccountMenu } from "../components/AccountMenu";
import { BrandLogo } from "../components/BrandLogo";
import { CourseLessonContent } from "../components/CourseLessonContent";
import { Sidebar } from "../components/Sidebar";
import { api, type ApiCourseDetail, type ApiEnrollment, type ApiLesson } from "../lib/api";

type Message = { role: "tutor" | "student"; text: string };

const initialMessages: Message[] = [
  { role: "tutor", text: "I am ready to help with this course step. Tell me what you are trying to do or where the result differs from the lesson." },
];

const vmUrl = process.env.NEXT_PUBLIC_LEARNING_VM_URL;
const courseRailWidthStorageKey = "aivirteach.lab.courseRailWidth.v1";
const minCourseRailWidth = 320;
const maxCourseRailWidth = 620;

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
  const [lesson, setLesson] = useState<ApiLesson | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [courseChecked, setCourseChecked] = useState(false);
  const [contentError, setContentError] = useState("");
  const [lessonLoading, setLessonLoading] = useState(false);
  const [completionStatus, setCompletionStatus] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [refreshing, setRefreshing] = useState(false);
  const [courseSummaryCollapsed, setCourseSummaryCollapsed] = useState(false);
  const [tutorCollapsed, setTutorCollapsed] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [courseRailWidth, setCourseRailWidth] = useState(420);
  const [vmEnvOpen, setVmEnvOpen] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vmEnvCloseButtonRef = useRef<HTMLButtonElement>(null);

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
    }).catch((caught) => {
      if (active) setContentError(caught instanceof Error ? caught.message : "Could not load the course.");
    }).finally(() => { if (active) setCourseChecked(true); });
    return () => { active = false; };
  }, []);

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
    }).catch((caught) => {
      if (active) setContentError(caught instanceof Error ? caught.message : "Could not load this step.");
    }).finally(() => { if (active) setLessonLoading(false); });
    return () => { active = false; };
  }, [course, selectedLessonId]);

  useEffect(() => {
    api.chatMessages("learning-lab").then((items) => {
      if (items.length) setMessages(items.map((item) => ({ role: item.role, text: item.text })));
    }).catch(() => undefined);
  }, []);

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
    } catch (caught) {
      setCompletionStatus(caught instanceof Error ? caught.message : "Could not complete this step.");
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    setMessage("");
    try {
      const response = await api.sendChatMessage(`course-${course?.id ?? "learning-lab"}`, text);
      setMessages((current) => [...current, { role: "student", text: response.studentMessage.text }, { role: "tutor", text: response.tutorMessage.text }]);
    } catch (caught) {
      setMessages((current) => [...current, { role: "student", text }, { role: "tutor", text: caught instanceof Error ? caught.message : "The tutor is unavailable." }]);
    }
  }

  function refreshTutor() {
    if (refreshTimer.current) return;
    setRefreshing(true);
    refreshTimer.current = setTimeout(() => {
      api.chatMessages(`course-${course?.id ?? "learning-lab"}`).then((items) => {
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
          <header className="vm-toolbar"><div><span className="vm-status-dot" aria-hidden="true" /><strong>Learning VM</strong></div><small>{vmUrl ? "Connected workspace" : "Awaiting connection"}</small></header>
          {vmUrl ? <iframe className="vm-frame" src={vmUrl} title="Interactive learning virtual machine" allow="clipboard-read; clipboard-write; fullscreen" /> : <section className="vm-empty-state" role="status"><span className="vm-display-icon" aria-hidden="true" /><h2>Learning VM</h2><p>The VM interface will appear here when a workspace URL is connected.</p></section>}
        </main>

        <aside className={`lab-tutor-rail ${tutorCollapsed ? "collapsed" : ""}`} aria-label="AI teacher">{tutorCollapsed ? <button className="lab-tutor-expand" type="button" onClick={() => setTutorCollapsed(false)} aria-label="Expand AI teacher"><span className="bot-mark">AI</span><i className="collapse-glyph points-left" aria-hidden="true" /></button> : <><header><div className="tutor-heading"><span className="bot-mark">AI</span><div><strong>AIVir Teacher</strong><small><i /> Online</small></div></div><div className="tutor-header-actions"><button className={`tutor-refresh ${refreshing ? "refreshing" : ""}`} type="button" onClick={refreshTutor} aria-label="Refresh tutor conversation"><img src="/refresh-icon.png" alt="" aria-hidden="true" /></button><button className="lab-rail-toggle points-right" type="button" onClick={() => setTutorCollapsed(true)} aria-label="Collapse AI teacher"><span aria-hidden="true" /></button></div></header><div className={`messages ${refreshing ? "refreshing" : ""}`}>{messages.map((item, index) => <article className={`message ${item.role}`} key={`${item.role}-${index}`}><div><p>{item.text}</p><small>{index === messages.length - 1 ? "Just now" : "Earlier"}</small></div></article>)}</div><form className="message-form" onSubmit={sendMessage}><input value={message} onChange={(event) => setMessage(event.target.value)} aria-label="Ask the tutor for help" placeholder="Ask about this step..." /><button aria-label="Send message">Send</button></form></> }</aside>
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
