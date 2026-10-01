// Keep this client copy of __fixtures__/canonical-lesson.json aligned with
// aivirteach-server/packages/lesson-blocks/fixtures/canonical-lesson.json.

export type HeadingBlock = {
  id: string;
  type: "heading";
  props: { level: 2 | 3; text: string };
};

export type ParagraphBlock = {
  id: string;
  type: "paragraph";
  props: { text: string };
};

export type BulletListBlock = {
  id: string;
  type: "bulletList";
  props: { items: string[] };
};

export type NumberedListBlock = {
  id: string;
  type: "numberedList";
  props: { items: string[] };
};

export type CodeBlock = {
  id: string;
  type: "code";
  props: {
    kind: "terminal" | "file" | "plain";
    code: string;
    language?: string;
    label?: string;
    description?: string;
  };
};

export type StepBlock = {
  id: string;
  type: "step";
  props: { number: number; title: string; body?: string };
};

export type CalloutBlock = {
  id: string;
  type: "callout";
  props: { variant: "tip" | "warning" | "note"; title?: string; body: string };
};

export type TableBlock = {
  id: string;
  type: "table";
  props: { columns: string[]; rows: string[][] };
};

export type ImageBlock = {
  id: string;
  type: "image";
  props: { assetId: string; alt: string; caption?: string };
};

export type ResourceLinkBlock = {
  id: string;
  type: "resourceLink";
  props: { url: string; title: string; description?: string };
};

export type DividerBlock = {
  id: string;
  type: "divider";
  props: Record<string, never>;
};

export type AnnotatedCodeBlock = {
  id: string;
  type: "annotatedCode";
  props: {
    title?: string;
    fileLabel?: string;
    steps: Array<{
      label: string;
      code: string;
      explanationTitle?: string;
      explanation?: string;
      terms: Array<{ term: string; description: string }>;
    }>;
  };
};

export type DiagramBlock = {
  id: string;
  type: "diagram";
  props: {
    title?: string;
    nodes: Array<{ id: string; title: string; description?: string }>;
    connections: Array<{ from: string; to: string; label?: string }>;
  };
};

export type LessonBlock =
  | HeadingBlock
  | ParagraphBlock
  | BulletListBlock
  | NumberedListBlock
  | CodeBlock
  | StepBlock
  | CalloutBlock
  | TableBlock
  | ImageBlock
  | ResourceLinkBlock
  | DividerBlock
  | AnnotatedCodeBlock
  | DiagramBlock;

export type RawLessonBlock = { id: string; type: string; props: unknown };

export type LessonAssets = Record<string, { url: string; alt?: string }>;
