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
  const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const string = (key: string) => typeof props[key] === "string";
  const optionalString = (key: string) => props[key] === undefined || string(key);
  const strings = (key: string) => Array.isArray(props[key]) && props[key].every((item) => typeof item === "string");
  switch (block.type) {
    case "heading": return (props.level === 2 || props.level === 3) && string("text");
    case "paragraph": return string("text");
    case "bulletList": case "numberedList": return strings("items");
    case "code": return ["terminal", "file", "plain"].includes(String(props.kind)) && string("code") && optionalString("language") && optionalString("label") && optionalString("description");
    case "step": return typeof props.number === "number" && string("title") && (props.body === undefined || string("body"));
    case "callout": return ["tip", "warning", "note"].includes(String(props.variant)) && string("body") && optionalString("title");
    case "table": return strings("columns") && Array.isArray(props.rows) && props.rows.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "string"));
    case "image": return string("assetId") && string("alt") && (props.caption === undefined || string("caption"));
    case "resourceLink": return string("url") && string("title") && (props.description === undefined || string("description"));
    case "divider": return true;
    case "annotatedCode": return optionalString("title") && optionalString("fileLabel") && Array.isArray(props.steps) && props.steps.every((step) => record(step)
      && typeof step.label === "string" && typeof step.code === "string"
      && (step.explanationTitle === undefined || typeof step.explanationTitle === "string")
      && (step.explanation === undefined || typeof step.explanation === "string")
      && Array.isArray(step.terms) && step.terms.every((term) => record(term) && typeof term.term === "string" && typeof term.description === "string"));
    case "diagram": return optionalString("title") && Array.isArray(props.nodes) && props.nodes.every((node) => record(node)
      && typeof node.id === "string" && typeof node.title === "string"
      && (node.description === undefined || typeof node.description === "string"))
      && Array.isArray(props.connections) && props.connections.every((edge) => record(edge)
        && typeof edge.from === "string" && typeof edge.to === "string"
        && (edge.label === undefined || typeof edge.label === "string"));
    default: return false;
  }
}

function safeRender(block: RawLessonBlock, assets: LessonAssets): ReactNode | null {
  try {
    if (typeof block.id !== "string" || !validProps(block)) return null;
    if (block.type === "image") {
      const asset = (assets as unknown as Record<string, unknown>)[(block.props as { assetId: string }).assetId];
      if (asset !== undefined && (!asset || typeof asset !== "object" || Array.isArray(asset) || typeof (asset as Record<string, unknown>).url !== "string")) return null;
    }
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
  return <div className="lesson-blocks lesson-markdown">{blocks.map((block, index) => {
    const candidate = block as unknown;
    const blockRecord = candidate !== null && typeof candidate === "object" && !Array.isArray(candidate)
      ? candidate as Record<string, unknown>
      : null;
    const blockId = typeof blockRecord?.id === "string" ? blockRecord.id : undefined;
    const rendered = blockRecord ? safeRender(block, assets) : null;
    const blockProblems = problems.filter((problem) => problem.blockId === blockId);
    const errors = blockProblems.filter((problem) => problem.level === "error");
    const warningLabels = mode === "preview" ? blockProblems.filter((problem) => problem.level === "warning") : [];
    if (!rendered || (mode === "preview" && errors.length > 0)) {
      if (mode === "learner") return null;
      const messages = errors.map((problem) => problem.message);
      return <div className="lb-block" key={`${blockId ?? "invalid"}-${index}`}><InvalidBlock messages={messages.length ? messages : ["该块无法渲染"]} />{warningLabels.map((warning, warningIndex) => <small className="lb-warning" key={`${warningIndex}-${warning.message}`}>{warning.message}</small>)}</div>;
    }
    const fallback = mode === "preview" ? <InvalidBlock messages={errors.map((problem) => problem.message)} /> : null;
    return <div className="lb-block" key={`${blockId ?? "invalid"}-${index}`}><BlockErrorBoundary fallback={fallback}>{rendered}</BlockErrorBoundary>{warningLabels.map((warning, warningIndex) => <small className="lb-warning" key={`${warningIndex}-${warning.message}`}>{warning.message}</small>)}</div>;
  })}</div>;
}
