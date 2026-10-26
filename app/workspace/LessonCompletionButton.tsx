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
  const courseUpdated = progress.recovery === "reload-course";
  const syncFailed = progress.recovery === "retry-sync";
  const status = courseUpdated ? "reload-course" : failed || syncFailed ? "failed" : completion.status;
  const label = courseUpdated ? t("Course updated · Reload", "课程已更新，点击更新")
    : completion.status === "saving" ? t("Saving…", "保存中…")
    : failed ? t("Save failed · Retry", "保存失败，点击重试")
    : syncFailed ? t("Sync failed · Retry", "同步失败，点击重试")
    : completion.status === "saved" ? (completed ? t("Completed · Saved", "本节已学完 · 已保存") : t("Not completed · Saved", "未标记完成 · 已保存"))
    : completed ? t("Lesson completed", "本节已学完")
    : t("Mark lesson complete", "标记本节已学完");
  const percent = progress.snapshot?.progressPercent ?? 0;
  const canRecover = courseUpdated || failed || syncFailed;
  const completionDescription = t("Self-reported progress; assessment results are separate.", "这是学习记录；评测通过由系统单独判定。");
  return <section className="lesson-progress" aria-label={t("Learning progress", "学习进度")}>
    <div className="lesson-progress-heading"><span>{t("Learning progress", "学习进度")}</span><span>{progress.snapshot?.completedLessonIds.length ?? 0} / {progress.snapshot?.totalLessons ?? 0} {t("completed", "已完成")}</span></div>
    <div className="lesson-progress-meter"><progress max={100} value={percent} aria-label={t("Course completion", "课程完成进度")} /><span>{percent}%</span></div>
    <div className="learning-completion-control" data-tooltip={completionDescription}>
      <Button className="lesson-completion-button" variant="outline" type="button" data-completion-state={status} aria-busy={completion.status === "saving"} aria-pressed={canRecover ? undefined : completed} aria-description={completionDescription} disabled={progress.busy || (!canRecover && (disabled || !lessonId || !progress.snapshot?.active))} onClick={() => {
        if (canRecover) void progress.recover(lessonId);
        else void progress.setCompleted(lessonId, !completed);
      }}>
        {completed && !canRecover && completion.status !== "saving" && <span aria-hidden="true">✓</span>}
        <span role="status" aria-live="polite">{label}</span>
      </Button>
    </div>
  </section>;
}
