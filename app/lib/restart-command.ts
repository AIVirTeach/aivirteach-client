import type { ApiLearningProgress, LearningSnapshotCommand } from "./api";

export function restartCommandForCourse(
  commands: Map<string, LearningSnapshotCommand>,
  courseId: string,
  current: ApiLearningProgress,
  requestId: () => string,
) {
  const existing = commands.get(courseId);
  if (existing) return existing;
  const command = { requestId: requestId(), generation: current.generation, revision: current.revision, courseVersionId: current.courseVersionId };
  commands.set(courseId, command);
  return command;
}
