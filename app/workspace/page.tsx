"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Avatar } from "../components/Avatar";

const starterCode = `import pandas as pd

# Load the dataset
df = pd.read_csv('data.csv')

# Your task: Filter the dataframe by column 'A' > 10
filtered_df = df

print(filtered_df.head())`;

type Message = { role: "tutor" | "student"; text: string };

export default function WorkspacePage() {
  const [code, setCode] = useState(starterCode);
  const [output, setOutput] = useState("Ready");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "tutor", text: "Let's tackle this filtering task. Remember how we used boolean indexing in the previous module?" },
    { role: "student", text: "I think I need to use df['A'] > 10 somehow." },
    { role: "tutor", text: "You're doing great! That's exactly the right boolean condition. Try passing that condition inside square brackets or using .loc to apply the filter." },
  ]);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);

  function runCode() {
    setOutput(code.includes("df['A'] > 10") ? "5 rows returned · execution completed" : "Code ran successfully · filter not applied yet");
  }

  function checkWork() {
    setOutput(code.includes("df[df['A'] > 10]") || code.includes("df.loc[df['A'] > 10]") ? "Great work — task complete!" : "Almost there — wrap the boolean condition in df[ ... ].");
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    setMessages((current) => [...current, { role: "student", text }, { role: "tutor", text: "Good question. Focus on selecting rows from df with the condition inside square brackets." }]);
    setMessage("");
  }

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div className="workspace-title"><Link href="/dashboard" aria-label="Exit lesson">×</Link><div><h1>Module 4: Advanced Pandas</h1><div className="module-progress"><span><i /></span><b>66%</b></div></div></div>
        <div className="workspace-actions"><button onClick={() => setOutlineOpen((value) => !value)}>☷ &nbsp; Outline</button><Avatar size="small" /></div>
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
        <section className={`tutor-panel ${tutorOpen ? "open" : ""}`}>
          <header><div className="tutor-heading"><span className="bot-mark">▣</span><div><strong>Cognitive Tutor</strong><small><i /> Online</small></div></div><button className="tutor-close" onClick={() => setTutorOpen(false)} aria-label="Close tutor">×</button></header>
          <div className="messages">{messages.map((item, index) => <article className={`message ${item.role}`} key={`${item.role}-${index}`}><Avatar name={item.role === "tutor" ? "Cognitive Tutor" : "Alex Chen"} size="small" tone={item.role === "tutor" ? "teal" : "neutral"} /><div><p>{item.text}</p><small>{index === messages.length - 1 ? "Just now" : "2 mins ago"}</small></div></article>)}</div>
          <form className="message-form" onSubmit={sendMessage}><input value={message} onChange={(event) => setMessage(event.target.value)} aria-label="Ask the tutor for help" placeholder="Ask for help..." /><button aria-label="Send message">➤</button></form>
        </section>
        <button className="tutor-fab" onClick={() => setTutorOpen(true)} aria-label="Open AI tutor">▣<span /></button>
      </div>
    </main>
  );
}
