"use client";

import { useState, type ReactNode } from "react";

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; language: string; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "rule" };

export function CourseLessonContent({ markdown }: { markdown: string }) {
  return <div className="lesson-markdown">{parseBlocks(markdown).map(renderBlock)}</div>;
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: { language: string; lines: string[] } | null = null;

  function flushParagraph() {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  }

  function flushList() {
    if (list) blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  }

  for (const line of lines) {
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      flushParagraph();
      flushList();
      if (code) {
        blocks.push({ type: "code", language: code.language, text: code.lines.join("\n") });
        code = null;
      } else {
        code = { language: fence[1].trim(), lines: [] };
      }
      continue;
    }
    if (code) {
      code.lines.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    const listItem = line.match(/^\s*(?:(\d+)\.|[-*])\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
    } else if (listItem) {
      flushParagraph();
      const ordered = Boolean(listItem[1]);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(listItem[2]);
    } else if (/^---+$/.test(line.trim())) {
      flushParagraph();
      flushList();
      blocks.push({ type: "rule" });
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  if (code) blocks.push({ type: "code", language: code.language, text: code.lines.join("\n") });
  return blocks;
}

function renderBlock(block: Block, index: number): ReactNode {
  if (block.type === "heading") {
    const Tag = block.level <= 2 ? "h2" : "h3";
    return <Tag key={index}>{inline(block.text)}</Tag>;
  }
  if (block.type === "paragraph") return <p key={index}>{inline(block.text)}</p>;
  if (block.type === "code") return <CodeBlock key={index} language={block.language} text={block.text} />;
  if (block.type === "rule") return <hr key={index} />;
  const Tag = block.ordered ? "ol" : "ul";
  return <Tag key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</Tag>;
}

function CodeBlock({ language, text }: { language: string; text: string }) {
  const [status, setStatus] = useState("Copy");

  async function copyCode() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const input = document.createElement("textarea");
        input.value = text;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand("copy");
        input.remove();
        if (!copied) throw new Error("Clipboard unavailable");
      }
      setStatus("Copied");
    } catch {
      setStatus("Copy failed");
    }
    window.setTimeout(() => setStatus("Copy"), 1800);
  }

  return <div className="lesson-code-block"><header><span>{language || "code"}</span><button type="button" onClick={() => void copyCode()}>{status}</button></header><pre><code data-language={language}>{text}</code></pre></div>;
}

function inline(text: string) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return part;
  });
}
