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

function isLessonBlockProblem(value: unknown): value is LessonBlockProblem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const problem = value as Record<string, unknown>;
  return (problem.blockId === undefined || typeof problem.blockId === "string")
    && (problem.level === "error" || problem.level === "warning")
    && typeof problem.message === "string";
}

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
    problems: Array.isArray(data.problems) ? data.problems.filter(isLessonBlockProblem) : [],
  };
}

export function previewHeaders(adminOrigin?: string): Record<string, string> {
  return {
    "Content-Security-Policy": `frame-ancestors ${adminOrigin || "'none'"}`,
    "Cache-Control": "no-store",
  };
}

// 值在构建时就写进响应头，事后补设无效；event.origin 永远不带路径和结尾斜杠，写错会让预览静默失效。
export function adminOriginProblem(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return "NEXT_PUBLIC_ADMIN_ORIGIN is not set: /preview/lesson cannot be framed and accepts no messages.";
  try {
    if (new URL(trimmed).origin === trimmed) return null;
  } catch {
    // 落到下面的统一提示
  }
  return `NEXT_PUBLIC_ADMIN_ORIGIN "${trimmed}" is not a bare origin (expected e.g. https://admin.example.com, no path or trailing slash).`;
}
