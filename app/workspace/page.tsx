"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { AccountMenu } from "../components/AccountMenu";
import { BrandLogo } from "../components/BrandLogo";
import { Sidebar } from "../components/Sidebar";
import { useLearnerProfile } from "../hooks/useLearnerProfile";
import { api } from "../lib/api";
import { readActiveCourse, type DemoCourse } from "../lib/courses";

const starterCode = `import pandas as pd

# Load the dataset
df = pd.read_csv('data.csv')

# Your task: Filter the dataframe by column 'A' > 10
filtered_df = df

print(filtered_df.head())`;

type Message = { role: "tutor" | "student"; text: string };

const initialMessages: Message[] = [
  { role: "tutor", text: "Let's tackle this filtering task. Remember how we used boolean indexing in the previous module?" },
  { role: "student", text: "I think I need to use df['A'] > 10 somehow." },
  { role: "tutor", text: "You're doing great! That's exactly the right boolean condition. Try passing that condition inside square brackets or using .loc to apply the filter." },
];

const chapters = ["Foundations", "Core concepts", "Guided build", "Connect the pieces", "Test and refine", "Final challenge"];
const chapterSteps = [
  { label: "Review the project brief", status: "complete" },
  { label: "Open the workspace", status: "complete" },
  { label: "Complete the guided task", status: "current" },
  { label: "Check your work", status: "upcoming" },
] as const;

function formatElapsed(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export default function WorkspacePage() {
  const router = useRouter();
  const { completeWorkspaceTask } = useLearnerProfile();
  const [code, setCode] = useState(starterCode);
  const [output, setOutput] = useState("Ready");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [taskComplete, setTaskComplete] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [courseChecked, setCourseChecked] = useState(false);
  const [activeCourse, setActiveCourse] = useState<DemoCourse | null>(null);
  const [courseSummaryCollapsed, setCourseSummaryCollapsed] = useState(false);
  const [tutorCollapsed, setTutorCollapsed] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  useEffect(() => {
    api.enrollments().then((enrollments) => {
      const selectedCourse = enrollments.find((enrollment) => enrollment.active)?.courseId;
      if (selectedCourse) window.localStorage.setItem("aivirteach.activeCourse.v1", selectedCourse);
      setActiveCourse(readActiveCourse());
    }).catch(() => setActiveCourse(readActiveCourse())).finally(() => setCourseChecked(true));
  }, []);

  useEffect(() => {
    api.chatMessages("learning-lab").then((items) => {
      if (items.length > 0) setMessages(items.map((item) => ({ role: item.role, text: item.text })));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!activeCourse) return;
    const storageKey = `aivirteach.lab.activeSeconds.${activeCourse.id}`;
    const restoreTimer = window.setTimeout(() => {
      const savedSeconds = Number(window.localStorage.getItem(storageKey));
      if (Number.isFinite(savedSeconds) && savedSeconds > 0) setElapsedSeconds(savedSeconds);
    }, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      setElapsedSeconds((current) => {
        const next = current + 1;
        window.localStorage.setItem(storageKey, String(next));
        return next;
      });
    }, 1000);
    return () => {
      window.clearTimeout(restoreTimer);
      window.clearInterval(timer);
    };
  }, [activeCourse]);

  useEffect(() => {
    let active = true;
    async function measureLatency() {
      const startedAt = performance.now();
      try {
        await api.health();
        if (active) setLatency(Math.max(1, Math.round(performance.now() - startedAt)));
      } catch {
        if (active) setLatency(null);
      }
    }
    void measureLatency();
    const interval = window.setInterval(() => void measureLatency(), 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  function runCode() {
    setOutput(code.includes("df['A'] > 10") ? "5 rows returned - execution completed" : "Code ran successfully - filter not applied yet");
  }

  async function checkWork() {
    const correct = code.includes("df[df['A'] > 10]") || code.includes("df.loc[df['A'] > 10]");
    setOutput(correct ? "Great work - task complete! Your progress has been updated." : "Almost there - wrap the boolean condition in df[ ... ].");
    if (correct && !taskComplete) {
      await completeWorkspaceTask();
      setTaskComplete(true);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    setMessage("");
    try {
      const response = await api.sendChatMessage("learning-lab", text);
      setMessages((current) => [...current, { role: "student", text: response.studentMessage.text }, { role: "tutor", text: response.tutorMessage.text }]);
    } catch (caught) {
      setMessages((current) => [...current, { role: "student", text }, { role: "tutor", text: caught instanceof Error ? caught.message : "The tutor is unavailable." }]);
    }
  }

  function refreshTutor() {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    refreshTimer.current = setTimeout(() => {
      api.chatMessages("learning-lab").then((items) => {
        setMessages(items.length > 0 ? items.map((item) => ({ role: item.role, text: item.text })) : initialMessages.map((item) => ({ ...item })));
      }).finally(() => {
        setMessage("");
        setRefreshing(false);
        refreshTimer.current = null;
      });
    }, 850);
  }

  if (!courseChecked || !activeCourse) {
    return (
      <div className="app-shell">
        <Sidebar active="workspace" />
        <main className="course-required-page">
          <section className="course-required-card" role="status">
            <h1>{courseChecked ? "Choose a course first" : "Opening Learning Lab..."}</h1>
            <p>{courseChecked ? "Choose a course before opening its project workspace." : "Checking for your active course."}</p>
            {courseChecked && <button className="primary-button" type="button" onClick={() => router.replace("/courses")}>Browse courses</button>}
          </section>
        </main>
      </div>
    );
  }

  const latencyBars = latency === null ? 0 : latency < 80 ? 4 : latency < 160 ? 3 : latency < 300 ? 2 : 1;

  return (
    <div className={`workspace-shell lab-shell ${courseSummaryCollapsed ? "summary-collapsed" : ""} ${tutorCollapsed ? "tutor-collapsed" : ""}`}>
      <div className="lab-frame">
        <aside className={`lab-course-rail ${courseSummaryCollapsed ? "collapsed" : ""}`} aria-label="Course summary">
          <header className="lab-course-brand">
            <BrandLogo className="lab-brand-logo" />
            <span className="lab-brand-mark" role="img" aria-label="AIVirTeach" />
            {!courseSummaryCollapsed && <button className="lab-rail-toggle points-left" type="button" onClick={() => setCourseSummaryCollapsed(true)} aria-label="Collapse course summary"><span aria-hidden="true" /></button>}
          </header>
          {courseSummaryCollapsed && <button className="lab-course-rail-expand" type="button" onClick={() => setCourseSummaryCollapsed(false)} aria-label="Expand course summary" />}
          {!courseSummaryCollapsed && (
            <div className="lab-course-content">
              <section className="lab-next-action">
                <small>NEXT ACTION</small>
                <strong>Complete the guided task</strong>
                <button type="button" onClick={() => editorRef.current?.focus()}>Open task</button>
              </section>
              <nav className="chapter-timeline" aria-label="Course chapters">
                <ol>
                  {chapters.map((chapter, chapterIndex) => (
                    <li className={chapterIndex === 0 ? "active" : "upcoming"} key={chapter}>
                      <div className="chapter-row"><span>{chapterIndex + 1}</span><div><small>Chapter {chapterIndex + 1}</small><strong>{chapter}</strong></div></div>
                      {chapterIndex === 0 && <ol className="chapter-steps">{chapterSteps.map((step) => <li className={step.status} key={step.label}><span /><strong>{step.label}</strong></li>)}</ol>}
                    </li>
                  ))}
                </ol>
              </nav>
            </div>
          )}
          <AccountMenu placement="lab" collapsed={courseSummaryCollapsed} />
        </aside>

        <header className="lab-project-header">
          <div className="lab-project-title"><small>PROJECT</small><h1>{activeCourse.title}</h1></div>
          <div className="lab-project-status">
            <div className="latency-status" title="Round-trip latency to the workspace service"><span className="latency-bars" aria-hidden="true">{[1, 2, 3, 4].map((bar) => <i className={bar <= latencyBars ? "active" : ""} key={bar} />)}</span><span><small>VM LATENCY</small><strong>{latency === null ? "Offline" : `${latency} ms`}</strong></span></div>
            <div className="lab-active-timer"><span className="timer-glyph" aria-hidden="true" /><span><small>ACTIVE TIME</small><strong>{formatElapsed(elapsedSeconds)}</strong></span></div>
          </div>
        </header>

        <main className="lab-workspace">
          <div className="task-copy"><span>Task 3 of 5</span><h2>Filter the DataFrame</h2><p>Filter rows where column <code>A</code> is greater than 10 and assign the result to <code>filtered_df</code>.</p></div>
          <div className="code-window">
            <div className="code-toolbar"><div><i /><i /><i /></div><span>analysis.py</span><small>Temporary workspace</small></div>
            <textarea ref={editorRef} aria-label="Python code editor" value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} />
            <div className="code-output" aria-live="polite">{output}</div>
            <div className="editor-actions"><button className="hint-button" type="button" onClick={() => setOutput("Hint: filtered_df = df[df['A'] > 10]")}>Hint</button><div><button type="button" onClick={runCode}>Run</button><button className="primary-button" type="button" onClick={() => void checkWork()}>Check Work</button></div></div>
          </div>
        </main>

        <aside className={`lab-tutor-rail ${tutorCollapsed ? "collapsed" : ""}`} aria-label="AI teacher">
          {tutorCollapsed ? (
            <button className="lab-tutor-expand" type="button" onClick={() => setTutorCollapsed(false)} aria-label="Expand AI teacher"><span className="bot-mark">AI</span><i className="collapse-glyph points-left" aria-hidden="true" /></button>
          ) : (
            <>
              <header><div className="tutor-heading"><span className="bot-mark">AI</span><div><strong>AIVir Teacher</strong><small><i /> Online</small></div></div><div className="tutor-header-actions"><button className={`tutor-refresh ${refreshing ? "refreshing" : ""}`} type="button" onClick={refreshTutor} aria-label={refreshing ? "Cancel chat refresh" : "Refresh tutor conversation"}>{refreshing ? <span className="refresh-cancel-glyph" aria-hidden="true" /> : <img src="/refresh-icon.png" alt="" aria-hidden="true" />}</button><button className="lab-rail-toggle points-right" type="button" onClick={() => setTutorCollapsed(true)} aria-label="Collapse AI teacher"><span aria-hidden="true" /></button></div></header>
              <div className={`messages ${refreshing ? "refreshing" : ""}`} aria-busy={refreshing}>{refreshing && <div className="chat-refresh-status" role="status"><i aria-hidden="true" /> Reloading conversation...</div>}{messages.map((item, index) => <article className={`message ${item.role}`} key={`${item.role}-${index}`}><div><p>{item.text}</p><small>{index === messages.length - 1 ? "Just now" : "2 mins ago"}</small></div></article>)}</div>
              <form className="message-form" onSubmit={sendMessage}><input value={message} onChange={(event) => setMessage(event.target.value)} aria-label="Ask the tutor for help" placeholder="Ask for help..." /><button aria-label="Send message">Send</button></form>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
