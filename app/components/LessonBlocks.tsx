"use client";

import type { ReactNode } from "react";
import {
  AnnotatedCodeBlock,
  DiagramBlock,
  ImageBlock,
  ResourceLinkBlock,
  TableBlock,
} from "./lesson-blocks/ComplexBlocks";
import {
  CalloutBlock,
  CodeBlock,
  DividerBlock,
  HeadingBlock,
  ListBlock,
  ParagraphBlock,
  StepBlock,
} from "./lesson-blocks/SimpleBlocks";
import { BlockErrorBoundary } from "./BlockErrorBoundary";
import type { LessonAssets, RawLessonBlock } from "../lib/lesson-blocks/types";

export type LessonBlockProblem = { blockId?: string; level: "error" | "warning"; message: string };
export type LessonBlocksProps = {
  blocks: RawLessonBlock[];
  assets: LessonAssets;
  mode: "learner" | "preview";
  problems?: LessonBlockProblem[];
};

function validProps(block: RawLessonBlock) {
  if (!block.props || typeof block.props !== "object" || Array.isArray(block.props)) return false;
  const props = block.props as Record<string, unknown>;
  const string = (key: string) => typeof props[key] === "string";
  const strings = (key: string) => Array.isArray(props[key]) && props[key].every((item) => typeof item === "string");
  switch (block.type) {
    case "heading": return (props.level === 2 || props.level === 3) && string("text");
    case "paragraph": return string("text");
    case "bulletList": case "numberedList": return strings("items");
    case "code": return ["terminal", "file", "plain"].includes(String(props.kind)) && string("code");
    case "step": return typeof props.number === "number" && string("title") && (props.body === undefined || string("body"));
    case "callout": return ["tip", "warning", "note"].includes(String(props.variant)) && string("body");
    case "table": return strings("columns") && Array.isArray(props.rows) && props.rows.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "string"));
    case "image": return string("assetId") && string("alt") && (props.caption === undefined || string("caption"));
    case "resourceLink": return string("url") && string("title") && (props.description === undefined || string("description"));
    case "divider": return true;
    case "annotatedCode": return Array.isArray(props.steps) && props.steps.every((step) => step && typeof step.label === "string" && typeof step.code === "string" && Array.isArray(step.terms));
    case "diagram": return Array.isArray(props.nodes) && props.nodes.every((node) => node && typeof node.id === "string" && typeof node.title === "string") && Array.isArray(props.connections) && props.connections.every((edge) => edge && typeof edge.from === "string" && typeof edge.to === "string");
    default: return false;
  }
}

function safeRender(block: RawLessonBlock, assets: LessonAssets): ReactNode | null {
  try {
    if (typeof block.id !== "string" || !validProps(block)) return null;
    switch (block.type) {
      case "heading": return <HeadingBlock id={block.id} props={block.props as Parameters<typeof HeadingBlock>[0]["props"]} />;
      case "paragraph": return <ParagraphBlock id={block.id} props={block.props as Parameters<typeof ParagraphBlock>[0]["props"]} />;
      case "bulletList": return <ListBlock id={block.id} props={block.props as Parameters<typeof ListBlock>[0]["props"]} ordered={false} />;
      case "numberedList": return <ListBlock id={block.id} props={block.props as Parameters<typeof ListBlock>[0]["props"]} ordered />;
      case "code": return <CodeBlock id={block.id} props={block.props as Parameters<typeof CodeBlock>[0]["props"]} />;
      case "step": return <StepBlock id={block.id} props={block.props as Parameters<typeof StepBlock>[0]["props"]} />;
      case "callout": return <CalloutBlock id={block.id} props={block.props as Parameters<typeof CalloutBlock>[0]["props"]} />;
      case "table": return <TableBlock id={block.id} props={block.props as Parameters<typeof TableBlock>[0]["props"]} />;
      case "image": return <ImageBlock id={block.id} props={block.props as Parameters<typeof ImageBlock>[0]["props"]} assets={assets} />;
      case "resourceLink": return <ResourceLinkBlock id={block.id} props={block.props as Parameters<typeof ResourceLinkBlock>[0]["props"]} />;
      case "divider": return <DividerBlock id={block.id} props={block.props as Parameters<typeof DividerBlock>[0]["props"]} />;
      case "annotatedCode": return <AnnotatedCodeBlock id={block.id} props={block.props as Parameters<typeof AnnotatedCodeBlock>[0]["props"]} />;
      case "diagram": return <DiagramBlock id={block.id} props={block.props as Parameters<typeof DiagramBlock>[0]["props"]} />;
      default: return null;
    }
  } catch {
    return null;
  }
}

function InvalidBlock({ messages }: { messages: string[] }) {
  return <div className="lb-invalid" role="alert"><strong>该块无法渲染</strong>{messages.map((message, index) => <small key={`${index}-${message}`}>{message}</small>)}</div>;
}

export function LessonBlocks({ blocks, assets, mode, problems = [] }: LessonBlocksProps) {
  return <div className="lesson-blocks">{blocks.map((block, index) => {
    const rendered = safeRender(block, assets);
    const blockProblems = problems.filter((problem) => problem.blockId === block.id);
    const errors = blockProblems.filter((problem) => problem.level === "error");
    const warningLabels = mode === "preview" ? blockProblems.filter((problem) => problem.level === "warning") : [];
    if (!rendered || (mode === "preview" && errors.length > 0)) {
      if (mode === "learner") return null;
      const messages = errors.map((problem) => problem.message);
      return <div className="lb-block" key={`${block.id}-${index}`}><InvalidBlock messages={messages.length ? messages : ["该块无法渲染"]} />{warningLabels.map((warning, warningIndex) => <small className="lb-warning" key={`${warningIndex}-${warning.message}`}>{warning.message}</small>)}</div>;
    }
    const fallback = mode === "preview" ? <InvalidBlock messages={errors.map((problem) => problem.message)} /> : null;
    return <div className="lb-block" key={`${block.id}-${index}`}><BlockErrorBoundary fallback={fallback}>{rendered}</BlockErrorBoundary>{warningLabels.map((warning, warningIndex) => <small className="lb-warning" key={`${warningIndex}-${warning.message}`}>{warning.message}</small>)}</div>;
  })}</div>;
}
