"use client";

import { LessonBlocks, type LessonBlockProblem } from "./LessonBlocks";
import { CopyToVmContext, type CopyToVm } from "./lesson-blocks/copy-code";
import type { LessonAssets, RawLessonBlock } from "../lib/lesson-blocks/types";

type LessonHeading = {
  title: string;
  moduleTitle: string;
  assets?: LessonAssets;
};
export type CourseLessonViewProps = LessonHeading & (
  | { mode: "learner"; blocks: RawLessonBlock[]; copyToVm?: CopyToVm; problems?: never }
  | { mode: "preview"; blocks: RawLessonBlock[] | null; problems?: LessonBlockProblem[]; copyToVm?: never }
);

export function CourseLessonView(props: CourseLessonViewProps) {
  const { title, moduleTitle, blocks, assets = {} } = props;
  return <CopyToVmContext.Provider value={props.mode === "learner" ? props.copyToVm : undefined}>
    <article className="course-lesson-view">
      <div className="course-lesson-inner">
        <header className="course-lesson-heading">
          {moduleTitle && <p>{moduleTitle}</p>}
          <h1>{title}</h1>
        </header>
        <div className="course-lesson-body">
          {!blocks ? <p role="alert">课时内容格式无效 · Lesson content is missing or invalid</p> : blocks.length === 0
            ? <p role="status">暂无课时内容 · No lesson content yet</p>
            : <LessonBlocks blocks={blocks} assets={assets} mode={props.mode} problems={props.problems} />}
        </div>
      </div>
    </article>
  </CopyToVmContext.Provider>;
}
