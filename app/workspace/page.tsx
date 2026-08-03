"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { useMockProfile } from "../hooks/useMockProfile";
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

export default function WorkspacePage() {
  const router = useRouter();
  const { completeWorkspaceTask } = useMockProfile();
  const [code, setCode] = useState(starterCode);
  const [output, setOutput] = useState("Ready");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [taskComplete, setTaskComplete] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [courseChecked, setCourseChecked] = useState(false);
  const [activeCourse, setActiveCourse] = useState<DemoCourse | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  useEffect(() => {
    const selectedCourse = readActiveCourse();
    setActiveCourse(selectedCourse);
    setCourseChecked(true);
  }, []);

  function runCode() {
    setOutput(code.includes("df['A'] > 10") ? "5 rows returned · execution completed" : "Code ran successfully · filter not applied yet");
  }

  function checkWork() {
    const correct = code.includes("df[df['A'] > 10]") || code.includes("df.loc[df['A'] > 10]");
    setOutput(correct ? "Great work — task complete! Your mock profile has been updated." : "Almost there — wrap the boolean condition in df[ ... ].");
    if (correct && !taskComplete) {
      completeWorkspaceTask();
      setTaskComplete(true);
    }
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    setMessages((current) => [...current, { role: "student", text }, { role: "tutor", text: "Good question. Focus on selecting rows from df with the condition inside square brackets." }]);
    setMessage("");
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
      setMessages(initialMessages.map((item) => ({ ...item })));
      setMessage("");
      setRefreshing(false);
      refreshTimer.current = null;
    }, 850);
  }

  if (!courseChecked || !activeCourse) {
    return (
      <div className="app-shell">
        <Sidebar active="workspace" />
        <main className="course-required-page">
          <section className="course-required-card" role="status">
            <span aria-hidden="true">✦</span>
            <h1>{courseChecked ? "Choose a course first" : "Opening Learning Lab…"}</h1>
            <p>{courseChecked ? "Learning Lab works best with an active course. Browse the catalog and choose one when you’re ready." : "Checking for your active course."}</p>
            {courseChecked && <button className="primary-button" type="button" onClick={() => router.replace("/courses")}>Browse courses</button>}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell workspace-shell">
      <Sidebar active="workspace" />
      <main className="workspace-page">
       <div className="workspace-frame">
      <header className="workspace-header">
        <div className="workspace-title"><div><h1>Module 4: Advanced Pandas</h1><div className="module-progress"><span><i /></span><b>66%</b></div></div></div>
        <div className="workspace-actions"><button onClick={() => setOutlineOpen((value) => !value)}>☷ &nbsp; Outline</button></div>
      </header>
      {outlineOpen && <aside className="outline-popover"><strong>Module outline</strong><ol><li>Loading data</li><li>Inspecting columns</li><li className="current">Filtering rows</li><li>Grouping values</li><li>Final challenge</li></ol></aside>}
      <div className="workspace-body">
        <section className="editor-panel">
          <div className="task-copy"><span>Task 3 of 5</span><h2>Filter the DataFrame</h2><p>Using the dataframe <code>df</code>, filter out the rows where the value in column <code>&apos;A&apos;</code> is greater than 10. Assign the result to <code>filtered_df</code>.</p></div>
          <div className="code-window">
            <div className="code-toolbar"><div><i /><i /><i /></div><span>analysis.py</span></div>
            <textarea aria-label="Python code editor" value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} />
            <div className="code-output" aria-live="polite">{output}</div>
            <div className="editor-actions"><button className="hint-button" type="button" onClick={() => setOutput("Hint: filtered_df = df[df['A'] > 10]")}>○ Hint</button><div><button type="button" onClick={runCode}>▷ Run</button><button className="primary-button" type="button" onClick={checkWork}>✓ Check Work</button></div></div>
          </div>
        </section>
        <section className="tutor-panel">
          <header><div className="tutor-heading"><span className="bot-mark">▣</span><div><strong>AIVir Teacher</strong><small><i /> Online</small></div></div><button className={`tutor-refresh ${refreshing ? "refreshing" : ""}`} type="button" onClick={refreshTutor} aria-label={refreshing ? "Cancel chat refresh" : "Refresh tutor conversation"}>{refreshing ? <span className="refresh-cancel-glyph" aria-hidden="true" /> : <img src="/refresh-icon.png" alt="" aria-hidden="true" />}</button></header>
          <div className={`messages ${refreshing ? "refreshing" : ""}`} aria-busy={refreshing}>{refreshing && <div className="chat-refresh-status" role="status"><i aria-hidden="true" /> Reloading conversation…</div>}{messages.map((item, index) => <article className={`message ${item.role}`} key={`${item.role}-${index}`}><div><p>{item.text}</p><small>{index === messages.length - 1 ? "Just now" : "2 mins ago"}</small></div></article>)}</div>
          <form className="message-form" onSubmit={sendMessage}><input value={message} onChange={(event) => setMessage(event.target.value)} aria-label="Ask the tutor for help" placeholder="Ask for help..." /><button aria-label="Send message">➤</button></form>
        </section>
      </div>
      </div>
      </main>
    </div>
  );
}
