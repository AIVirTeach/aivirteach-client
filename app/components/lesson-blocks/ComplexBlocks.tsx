"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { isAllowedInlineHref, renderInline } from "../../lib/lesson-blocks/inline";
import type {
  AnnotatedCodeBlock as AnnotatedCodeModel,
  DiagramBlock as DiagramModel,
  ImageBlock as ImageModel,
  LessonAssets,
  ResourceLinkBlock as ResourceLinkModel,
  TableBlock as TableModel,
} from "../../lib/lesson-blocks/types";
import { CopyButton } from "./SimpleBlocks";
import { ImageLightbox } from "./ImageLightbox";

type BlockProps<Block extends { id: string; props: unknown }> = Pick<Block, "id" | "props">;

export function TableBlock({ id, props }: BlockProps<TableModel>) {
  return <div id={id} className="lb-table-scroll" tabIndex={0} role="region" aria-label="课程表格">
    <table className="lb-table">
      <thead><tr>{props.columns.map((column, index) => <th key={`${index}-${column}`} scope="col">{renderInline(column)}</th>)}</tr></thead>
      <tbody>{props.rows.map((row, rowIndex) => <tr key={rowIndex}>{props.columns.map((_, columnIndex) => <td key={columnIndex}>{renderInline(row[columnIndex] ?? "")}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}

type ImageComponentProps = BlockProps<ImageModel> & { assets: LessonAssets };

export function ImageBlock({ id, props, assets }: ImageComponentProps) {
  const asset = assets[props.assetId];
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (wasOpen.current && !open) trigger.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (!asset) return <div id={id} className="lb-image-missing" role="img" aria-label="图片缺失">图片缺失</div>;

  return <figure id={id} className="lb-image">
    <button ref={trigger} type="button" className="lb-image-trigger" aria-label={`放大图片：${props.alt}`} onClick={() => setOpen(true)}>
      <Image src={asset.url} alt={props.alt} width={1200} height={800} unoptimized />
    </button>
    {props.caption ? <figcaption>{renderInline(props.caption)}</figcaption> : null}
    {open ? <ImageLightbox src={asset.url} alt={props.alt} onClose={close} /> : null}
  </figure>;
}

export function ResourceLinkBlock({ id, props }: BlockProps<ResourceLinkModel>) {
  const allowed = isAllowedInlineHref(props.url);
  const card = <>
    <strong>{renderInline(props.title)}</strong>
    {props.description ? <span>{renderInline(props.description)}</span> : null}
    {allowed ? <span className="lb-resource-url">{props.url}</span> : null}
  </>;
  return allowed
    ? <a id={id} className="lesson-activity lb-resource-link" href={props.url} target="_blank" rel="noopener noreferrer">{card}</a>
    : <div id={id} className="lesson-activity lb-resource-link">{card}</div>;
}

export function AnnotatedCodeBlock({ id, props }: BlockProps<AnnotatedCodeModel>) {
  return <section id={id} className="lb-annotated-code">
    {props.title ? <h3>{renderInline(props.title)}</h3> : null}
    {props.fileLabel ? <div className="lb-annotated-file">{renderInline(props.fileLabel)}</div> : null}
    <div className="lb-code-steps">{props.steps.map((step, index) => <article className="lb-code-step" key={`${index}-${step.label}`}>
      <div className="lb-code-source">
        <header><span>STEP {index + 1}</span><CopyButton text={step.code} /></header>
        <pre><code>{step.code}</code></pre>
      </div>
      <div className="lb-code-explanation">
        {step.explanationTitle ? <h4>{renderInline(step.explanationTitle)}</h4> : null}
        {step.explanation ? <p>{renderInline(step.explanation)}</p> : null}
        {step.terms.length ? <dl>{step.terms.map((term, termIndex) => <div key={`${termIndex}-${term.term}`}><dt>{renderInline(term.term)}</dt><dd>{renderInline(term.description)}</dd></div>)}</dl> : null}
      </div>
    </article>)}</div>
  </section>;
}

export function DiagramBlock({ id, props }: BlockProps<DiagramModel>) {
  const nodeIds = new Set(props.nodes.map((node) => node.id));
  const outgoing = new Map<string, typeof props.connections>();
  for (const connection of props.connections) {
    if (!nodeIds.has(connection.from) || !nodeIds.has(connection.to)) continue;
    const current = outgoing.get(connection.from) ?? [];
    outgoing.set(connection.from, [...current, connection]);
  }

  return <section id={id} className="lb-diagram">
    {props.title ? <h3>{renderInline(props.title)}</h3> : null}
    <div className="lb-diagram-flow">{props.nodes.map((node) => <div className="lb-diagram-node-group" key={node.id}>
      <article className="lb-diagram-node">
        <h4>{renderInline(node.title)}</h4>
        {node.description ? <p>{renderInline(node.description)}</p> : null}
      </article>
      {(outgoing.get(node.id) ?? []).map((connection, edgeIndex) => <div className="lb-diagram-edge" key={`${connection.from}-${connection.to}-${edgeIndex}`} aria-label={`连接到 ${props.nodes.find((candidate) => candidate.id === connection.to)?.title}`}>
        {connection.label ? <span>{renderInline(connection.label)}</span> : null}
        <span className="lb-diagram-arrow" aria-hidden="true">↓</span>
      </div>)}
    </div>)}</div>
  </section>;
}
