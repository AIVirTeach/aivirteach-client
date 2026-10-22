"use client";

import { type ComponentPropsWithoutRef, useRef, useState } from "react";
import { Markdown } from "@tanstack/markdown/react";
import { streamingMarkdownExtension } from "@tanstack/markdown/extensions/streaming";
import { localize, useLearningLanguage } from "../lib/language";
import { isSafeMarkdownHref } from "./markdown-safety";

const extensions = [streamingMarkdownExtension()];

function SafeAnchor({ href, children, ...rest }: ComponentPropsWithoutRef<"a">) {
  return <a {...rest} href={isSafeMarkdownHref(href) ? href : undefined}>{children}</a>;
}

function CodeBlock({ children, ...rest }: ComponentPropsWithoutRef<"pre">) {
  const codeRef = useRef<HTMLPreElement>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const language = useLearningLanguage();

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(codeRef.current?.textContent ?? "");
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return <div className="tutor-code-block">
    <div className="tutor-code-toolbar">
      <button type="button" onClick={copyCode}>{localize(language, "Copy code", "复制代码")}</button>
      <span role="status">{status === "copied" ? localize(language, "Copied", "已复制") : status === "failed" ? localize(language, "Copy failed; select the code to copy.", "复制失败，请选中代码复制。") : ""}</span>
    </div>
    <pre {...rest} ref={codeRef}>{children}</pre>
  </div>;
}

const components = { a: SafeAnchor, pre: CodeBlock };

export function TutorMessage({ text }: { text: string }) {
  return <div className="tutor-markdown"><Markdown extensions={extensions} components={components}>{text}</Markdown></div>;
}
