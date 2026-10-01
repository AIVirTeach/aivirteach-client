import type { LessonBlockProblem } from "../../components/LessonBlocks";
import type { LessonAssets, RawLessonBlock } from "./types";

export type PreviewPayload = {
  lesson: {
    title: string;
    moduleTitle: string;
    blocks: RawLessonBlock[];
  };
  assets: LessonAssets;
  problems: LessonBlockProblem[];
};

export function parsePreviewMessage(
  event: { origin: string; data: unknown },
  adminOrigin: string | undefined,
): PreviewPayload | null {
  if (!adminOrigin || event.origin !== adminOrigin) return null;
  if (!event.data || typeof event.data !== "object" || (event.data as { type?: unknown }).type !== "lesson-preview") return null;

  const data = event.data as Record<string, unknown>;
  const lesson = data.lesson && typeof data.lesson === "object" && !Array.isArray(data.lesson)
    ? data.lesson as Record<string, unknown>
    : {};
  return {
    lesson: {
      title: typeof lesson.title === "string" ? lesson.title : "",
      moduleTitle: typeof lesson.moduleTitle === "string" ? lesson.moduleTitle : "",
      blocks: Array.isArray(lesson.blocks) ? lesson.blocks as RawLessonBlock[] : [],
    },
    assets: data.assets && typeof data.assets === "object" && !Array.isArray(data.assets) ? data.assets as LessonAssets : {},
    problems: Array.isArray(data.problems) ? data.problems as LessonBlockProblem[] : [],
  };
}

export function previewHeaders(adminOrigin?: string): Record<string, string> {
  return {
    "Content-Security-Policy": `frame-ancestors ${adminOrigin || "'none'"}`,
    "Cache-Control": "no-store",
  };
}
