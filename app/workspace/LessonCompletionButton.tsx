"use client";

import { Button } from "@/components/ui/button";
import { localize, useLearningLanguage } from "../lib/language";
import type { useLearningProgress } from "./use-learning-progress";

type Progress = ReturnType<typeof useLearningProgress>;

export function LessonCompletionButton({ lessonId, progress, disabled = false }: {
  lessonId: string;
  progress: Progress;
  disabled?: boolean;
}) {
  const language = useLearningLanguage();
  const t = (en: string, zh: string) => localize(language, en, zh);
  const completion = progress.completion.status !== "idle" && progress.completion.command.lessonId === lessonId ? progress.completion : { status: "idle" } as const;
  const completed = progress.snapshot?.completedLessonIds.includes(lessonId) ?? false;
  const failed = completion.status === "failed";
  const syncFailed = !failed && Boolean(progress.error);
  const status = failed || syncFailed ? "failed" : completion.status;
  const label = completion.status === "saving" ? t("Saving…", "保存中…")
    : failed ? t("Save failed · Retry", "保存失败，点击重试")
    : syncFailed ? t("Sync failed · Retry", "同步失败，点击重试")
    : completion.status === "saved" ? (completed ? t("Completed · Saved", "本节已学完 · 已保存") : t("Not completed · Saved", "未标记完成 · 已保存"))
    : completed ? t("Lesson completed", "本节已学完")
    : t("Mark lesson complete", "标记本节已学完");
  const percent = progress.snapshot?.progressPercent ?? 0;
  const canRetry = failed || syncFailed;
  return <section className="lesson-progress" aria-label={t("Learning progress", "学习进度")}>
    <div className="lesson-progress-heading"><span>{t("Learning progress", "学习进度")}</span><span>{progress.snapshot?.completedLessonIds.length ?? 0} / {progress.snapshot?.totalLessons ?? 0} {t("completed", "已完成")}</span></div>
    <div className="lesson-progress-meter"><progress max={100} value={percent} aria-label={t("Course completion", "课程完成进度")} /><span>{percent}%</span></div>
    <Button className="lesson-completion-button" variant="outline" type="button" data-completion-state={status} aria-busy={completion.status === "saving"} aria-pressed={completed} disabled={progress.busy || (!canRetry && (disabled || !lessonId || !progress.snapshot?.active))} title={completed && !canRetry ? t("Click to mark incomplete", "点击取消完成") : undefined} onClick={() => {
      if (failed) void progress.retryCompletion();
      else if (syncFailed) void progress.reload();
      else void progress.setCompleted(lessonId, !completed);
    }}>
      {completed && !canRetry && completion.status !== "saving" && <span aria-hidden="true">✓</span>}
      <span role="status" aria-live="polite">{label}</span>
    </Button>
  </section>;
}
