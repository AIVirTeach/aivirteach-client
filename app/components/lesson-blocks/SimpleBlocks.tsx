"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { renderInline } from "../../lib/lesson-blocks/inline";
import type {
  BulletListBlock as BulletListModel,
  CalloutBlock as CalloutModel,
  CodeBlock as CodeModel,
  DividerBlock as DividerModel,
  HeadingBlock as HeadingModel,
  NumberedListBlock as NumberedListModel,
  ParagraphBlock as ParagraphModel,
  StepBlock as StepModel,
} from "../../lib/lesson-blocks/types";

type BlockProps<Block extends { id: string; props: unknown }> = Pick<Block, "id" | "props">;

export function HeadingBlock({ id, props }: BlockProps<HeadingModel>) {
  if (!props.text.trim()) return null;
  return props.level === 2 ? <h2 id={id}>{renderInline(props.text)}</h2> : <h3 id={id}>{renderInline(props.text)}</h3>;
}

export function ParagraphBlock({ id, props }: BlockProps<ParagraphModel>) {
  return <p id={id}>{renderInline(props.text)}</p>;
}

type ListProps = {
  id: string;
  props: BulletListModel["props"] | NumberedListModel["props"];
  ordered: boolean;
};

export function ListBlock({ id, props, ordered }: ListProps) {
  const items = props.items.filter((item) => item.trim().length > 0);
  if (items.length === 0) return null;
  if (ordered) {
    return <ol id={id}>{items.map((item, index) => <li key={`${index}-${item}`}>{renderInline(item)}</li>)}</ol>;
  }
  return <ul id={id}>{items.map((item, index) => <li key={`${index}-${item}`}>{renderInline(item)}</li>)}</ul>;
}

type CopyButtonProps = { text: string };

export function CopyButton({ text }: CopyButtonProps) {
  const [state, setState] = useState<"ready" | "copied" | "failed">("ready");

  useEffect(() => {
    if (state === "ready") return;
    const timeout = window.setTimeout(() => setState("ready"), 1800);
    return () => window.clearTimeout(timeout);
  }, [state]);

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return <Button variant="outline" size="xs" type="button" className="lesson-copy-button" aria-label="Copy code to clipboard" onClick={copy}>
    {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}
  </Button>;
}

export function CodeBlock({ props }: BlockProps<CodeModel>) {
  const heading = props.kind === "terminal" ? ">_"
    : props.kind === "file" ? `FILE  ${props.label ?? ""}`
      : props.language ?? "";

  return <div className="lesson-code-block" data-kind={props.kind}>
    <header><span>{heading}</span><CopyButton text={props.code} /></header>
    <pre><code>{props.code}</code></pre>
    {props.description ? <p>{renderInline(props.description)}</p> : null}
  </div>;
}

export function StepBlock({ id, props }: BlockProps<StepModel>) {
  return <section id={id} className="lesson-step">
    <span className="lesson-step-number" aria-hidden="true">{props.number}</span>
    <h3>{renderInline(props.title)}</h3>
    {props.body ? <p>{renderInline(props.body)}</p> : null}
  </section>;
}

const calloutVariantClass = {
  tip: "lesson-callout--success",
  note: "lesson-callout--primary",
  warning: "lesson-callout--warning",
} as const;

export function CalloutBlock({ id, props }: BlockProps<CalloutModel>) {
  return <aside id={id} className={`lesson-callout ${calloutVariantClass[props.variant]}`}>
    <h4>{renderInline(props.title ?? props.variant)}</h4>
    <p>{renderInline(props.body)}</p>
  </aside>;
}

export function DividerBlock({ id }: BlockProps<DividerModel>) {
  return <hr id={id} />;
}
