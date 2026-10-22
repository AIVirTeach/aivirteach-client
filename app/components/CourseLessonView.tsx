"use client";

import { CourseLessonContent } from "./CourseLessonContent";
import { LessonBlocks, type LessonBlockProblem } from "./LessonBlocks";
import { CopyToVmContext, type CopyToVm } from "./lesson-blocks/copy-code";
import type { LessonAssets, RawLessonBlock } from "../lib/lesson-blocks/types";

type LessonContent = {
  title: string;
  moduleTitle: string;
  blocks?: RawLessonBlock[] | null;
  markdown?: string;
  assets?: LessonAssets;
};
export type CourseLessonViewProps = LessonContent & (
  | { mode: "learner"; copyToVm?: CopyToVm; problems?: never }
  | { mode: "preview"; problems?: LessonBlockProblem[]; copyToVm?: never }
);

export function CourseLessonView(props: CourseLessonViewProps) {
  const { title, moduleTitle, blocks, assets = {}, markdown } = props;
  const empty = Array.isArray(blocks) ? blocks.length === 0 : !markdown?.trim();
  return <CopyToVmContext.Provider value={props.mode === "learner" ? props.copyToVm : undefined}>
    <article className="course-lesson-view">
      <div className="course-lesson-inner">
        <header className="course-lesson-heading">
          {moduleTitle && <p>{moduleTitle}</p>}
          <h1>{title}</h1>
        </header>
        <div className="course-lesson-body">
          {empty ? <p role="status">暂无课时内容 · No lesson content yet</p> : Array.isArray(blocks)
            ? <LessonBlocks blocks={blocks} assets={assets} mode={props.mode} problems={props.problems} />
            : <CourseLessonContent markdown={markdown} />}
        </div>
      </div>
    </article>
  </CopyToVmContext.Provider>;
}
