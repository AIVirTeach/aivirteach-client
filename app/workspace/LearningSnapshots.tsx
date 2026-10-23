"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api, type ApiLearningSnapshotSummary } from "../lib/api";
import { localize, useLearningLanguage } from "../lib/language";
import type { useLearningProgress } from "./use-learning-progress";
import { completedSnapshotLessonIds, snapshotReadingTitle } from "./snapshot-presentation";
import { createSnapshotHistoryController, type SnapshotHistoryState } from "./snapshot-history-controller";

type Progress = ReturnType<typeof useLearningProgress>;
const reasonLabel = (reason: ApiLearningSnapshotSummary["reason"], t: (en: string, zh: string) => string) => ({ MANUAL: t("Manual save", "手动保存"), RESTART: t("Before restart", "重新开始前"), COMPLETED: t("Course completed", "课程完成"), LEGACY_ACHIEVEMENT: t("Legacy completion", "历史结课") })[reason];
const formatTime = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function LearningSnapshots({ courseId, progress }: { courseId: string; progress: Progress }) {
  const language = useLearningLanguage();
  const t = useCallback((english: string, chinese: string) => localize(language, english, chinese), [language]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<SnapshotHistoryState>({ page: null, loading: false, error: "", selected: null, detail: null, detailLoading: false, detailError: "" });
  const historyController = useRef<ReturnType<typeof createSnapshotHistoryController> | null>(null);
  useEffect(() => {
    const controller = createSnapshotHistoryController(courseId, api, setHistory);
    historyController.current = controller;
    return () => { controller.dispose(); historyController.current = null; };
  }, [courseId]);

  const openHistory = () => {
    setHistoryOpen(true); historyController.current?.close();
    if (!history.page) void historyController.current?.load();
  };
  async function saveSnapshot() {
    const saved = await progress.saveSnapshot();
    if (saved) {
      setHistoryOpen(true);
      historyController.current?.close();
      await historyController.current?.refresh();
    }
  }

  const { page, loading: listLoading, error: listError, selected, detail, detailLoading, detailError } = history;
  const completedIds = detail ? completedSnapshotLessonIds(detail.state, detail.courseVersion) : new Set<string>();
  const pinnedReadingTitle = detail ? snapshotReadingTitle(detail) : null;

  return <section className="space-y-2" aria-label={t("Learning snapshots", "学习快照")}>
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" type="button" disabled={(!progress.snapshot?.active && !progress.pendingSnapshot) || progress.busy || progress.snapshotBusy || (Boolean(progress.error) && !progress.pendingSnapshot)} onClick={() => void saveSnapshot()}>
        {progress.snapshotBusy ? t("Saving…", "正在保存…") : progress.pendingSnapshot ? t("Retry same snapshot", "重试同一快照") : t("Save snapshot", "保存快照")}
      </Button>
      <Button variant="ghost" size="sm" type="button" onClick={openHistory}>{t("History", "历史记录")}</Button>
    </div>
    {progress.snapshotError && <p className="text-sm text-destructive" role="alert">{progress.snapshotError}</p>}
    {progress.savedSnapshot && <p className="text-xs text-muted-foreground" role="status">{t("Snapshot saved", "快照已保存")} · {formatTime(progress.savedSnapshot.createdAt)}</p>}
    <Dialog open={historyOpen} onOpenChange={(open) => { setHistoryOpen(open); if (!open) historyController.current?.close(); }}>
      <DialogContent className="w-full max-w-2xl max-h-[75dvh] overflow-y-auto">
        {selected ? <>
          <Button className="w-fit" variant="ghost" size="sm" type="button" onClick={() => historyController.current?.back()}>{t("Back to history", "返回历史记录")}</Button>
          <DialogTitle>{t("Snapshot details", "快照详情")}</DialogTitle>
          <DialogDescription>{reasonLabel(selected.reason, t)} · {formatTime(selected.createdAt)}</DialogDescription>
          {detailLoading && <p role="status">{t("Loading snapshot…", "正在加载快照…")}</p>}
          {detailError && <div role="alert"><p>{detailError}</p><Button variant="outline" type="button" onClick={() => void historyController.current?.open(selected)}>{t("Retry", "重试")}</Button></div>}
          {detail && (detail.schemaVersion !== 1 || !detail.courseVersion ? <div className="space-y-2">
            <p>{t("Complete lesson state and syllabus are unavailable for this legacy record.", "此历史记录没有可用的完整进度或课程大纲。")}</p>
            {detail.state.completedAt && <p>{t("Course completed", "结课时间")} · {formatTime(detail.state.completedAt)}</p>}
          </div> : <div className="space-y-3">
            <p>{t("Course version", "课程版本")} {detail.courseVersion.version} · {t("Learning round", "学习轮次")} {detail.sourceGeneration + 1}</p>
            {detail.state.completedAt ? <p>{t("Course completed", "结课时间")} · {formatTime(detail.state.completedAt)}</p> : <p>{completedIds.size} / {detail.courseVersion.modules.reduce((sum, module) => sum + module.lessons.length, 0)} {t("lessons completed", "课时已完成")}</p>}
            {pinnedReadingTitle && <p>{t("Reading position", "当时阅读位置")} · {pinnedReadingTitle}</p>}
            <ol className="list-decimal space-y-3 pl-5">{detail.courseVersion.modules.map((module, moduleIndex) => <li key={`${moduleIndex}-${module.title}`}><strong>{module.title}</strong><ol className="mt-1 list-decimal space-y-1 pl-5">{module.lessons.map((lesson) => <li key={lesson.contentId}>{lesson.title}{completedIds.has(lesson.contentId) && <span className="text-muted-foreground"> · {t("Completed", "已完成")}</span>}</li>)}</ol></li>)}</ol>
          </div>)}
        </> : <>
          <DialogTitle>{t("Snapshot history", "历史快照")}</DialogTitle>
          <DialogDescription>{t("Review saved progress against the course version used at that time.", "查看当时版本下保存的学习进度。")}</DialogDescription>
          {listError && <div role="alert" className="space-y-2"><p>{listError}</p><Button variant="outline" type="button" onClick={() => void historyController.current?.refresh()}>{t("Retry", "重试")}</Button></div>}
          {listLoading && !page ? <p role="status">{t("Loading snapshots…", "正在加载快照…")}</p> : page?.items.length ? <>
            <ol className="max-h-[55dvh] space-y-2 overflow-y-auto pr-1">{page.items.map((item) => <li key={item.id}><Button className="h-auto w-full justify-between gap-3 whitespace-normal p-3 text-left" variant="outline" type="button" onClick={() => void historyController.current?.open(item)} aria-label={`${reasonLabel(item.reason, t)} ${formatTime(item.createdAt)}`}><span className="grid gap-1"><strong>{reasonLabel(item.reason, t)}</strong><small className="text-muted-foreground">{formatTime(item.createdAt)}</small></span><span className="shrink-0 text-sm">{item.completeStateAvailable ? `${item.completedLessonCount} / ${item.totalLessons} · ${item.progressPercent}%` : t("Legacy record", "历史记录")}</span></Button></li>)}</ol>
            {page.nextCursor && <Button variant="outline" type="button" disabled={listLoading} onClick={() => void historyController.current?.loadNext()}>{listLoading ? t("Loading…", "正在加载…") : t("Load more", "加载更多")}</Button>}
          </> : !listLoading && !listError ? <p>{t("No saved snapshots yet.", "还没有保存的快照。")}</p> : null}
          {page && <Button className="mt-2" variant="ghost" size="sm" type="button" disabled={listLoading} onClick={() => void historyController.current?.refresh()}>{t("Refresh history", "刷新历史记录")}</Button>}
        </>}
      </DialogContent>
    </Dialog>
  </section>;
}
