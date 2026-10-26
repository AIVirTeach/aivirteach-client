import { describe, expect, it, vi } from "vitest";
import { ApiError, type ApiLearningProgress } from "../lib/api";
import { createLearningProgressController } from "./learning-progress-controller";

const initial: ApiLearningProgress = { enrollmentId: "e", courseId: "c", generation: 0, revision: 0, courseVersionId: "v1", courseVersion: 1, active: true, completedLessonIds: [], totalLessons: 2, currentLessonId: null, nextLessonId: "a", progressPercent: 0, status: "in_progress", achievements: [] };
const complete = (current: ApiLearningProgress, id: string, completed: boolean): ApiLearningProgress => ({ ...current, revision: current.revision + 1, completedLessonIds: completed ? [...current.completedLessonIds.filter(value => value !== id), id] : current.completedLessonIds.filter(value => value !== id) });
function setup() {
  const transport = {
    learningProgress: vi.fn().mockResolvedValue(initial),
    setReadingPosition: vi.fn().mockResolvedValue({ ...initial, revision: 1, currentLessonId: "b" }),
    setLessonProgress: vi.fn(async (_courseId: string, id: string, current: ApiLearningProgress, completed: boolean) => complete(current, id, completed)),
  };
  const publish = vi.fn();
  const host = { reloadCourse: vi.fn() };
  return { transport, publish, host, controller: createLearningProgressController("c", 1, transport, publish, host) };
}
function deferred<T>() {
  let resolve!: (state: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe("shared V1/V2 learning progress owner", () => {
  it("reading writes only a reading position; marking and undo use the returned revision", async () => {
    const { controller, transport, publish } = setup();
    await controller.reload();
    await controller.visit("b");
    expect(transport.setLessonProgress).not.toHaveBeenCalled();
    expect(await controller.setCompleted("b", true)).toBe(true);
    expect(publish.mock.lastCall?.[0].snapshot.completedLessonIds).toEqual(["b"]);
    expect(await controller.setCompleted("b", false)).toBe(true);
    expect(transport.setLessonProgress.mock.lastCall?.[2].revision).toBe(2);
    expect(transport.setLessonProgress.mock.lastCall?.[3]).toBe(false);
    expect(publish.mock.lastCall?.[0].completion).toMatchObject({ status: "saved", command: { lessonId: "b", completed: false } });
  });
  it("shows saving until confirmation and blocks duplicate completion clicks", async () => {
    const { controller, transport, publish } = setup();
    await controller.reload();
    const response = deferred<ApiLearningProgress>();
    transport.setLessonProgress.mockReturnValueOnce(response.promise);
    const pending = controller.setCompleted("b", true);
    expect(publish.mock.lastCall?.[0].completion.status).toBe("saving");
    expect(await controller.setCompleted("a", true)).toBe(false);
    await controller.reload();
    expect(transport.learningProgress).toHaveBeenCalledTimes(1);
    transport.learningProgress.mockResolvedValueOnce(complete(initial, "b", true));
    response.resolve(complete(initial, "b", true));
    await pending;
    expect(transport.setLessonProgress).toHaveBeenCalledTimes(1);
    expect(publish.mock.lastCall?.[0].completion.status).toBe("saved");
  });
  it("keeps navigation responsive and writes only the latest queued reading position", async () => {
    const { controller, transport, publish } = setup();
    await controller.reload();
    const response = deferred<ApiLearningProgress>();
    transport.setReadingPosition.mockReturnValueOnce(response.promise);
    const pending = controller.visit("a");
    expect(await controller.visit("b")).toBe(false);
    expect(await controller.visit("c")).toBe(false);
    response.resolve({ ...initial, revision: 1, currentLessonId: "a" });
    await pending;
    expect(transport.setReadingPosition.mock.calls.map(call => call[1])).toEqual(["a", "c"]);
    expect(publish.mock.lastCall?.[0].busy).toBe(false);
  });
  it("drains queued navigation after a requested refresh within the same round", async () => {
    const { controller, transport } = setup();
    await controller.reload();
    const response = deferred<ApiLearningProgress>();
    transport.setReadingPosition.mockReturnValueOnce(response.promise);
    const pending = controller.visit("a");
    await controller.visit("b");
    await controller.reload();
    response.resolve({ ...initial, revision: 1, currentLessonId: "a" });
    await pending;
    expect(transport.learningProgress).toHaveBeenCalledTimes(2);
    expect(transport.setReadingPosition.mock.calls.map(call => call[1])).toEqual(["a", "b"]);
  });
  it("drains a visit queued while a progress reload is pending", async () => {
    const { controller, transport } = setup();
    await controller.reload();
    const response = deferred<ApiLearningProgress>();
    transport.learningProgress.mockReturnValueOnce(response.promise);
    const pending = controller.reload();
    await controller.visit("b");
    response.resolve(initial);
    await pending;
    expect(transport.setReadingPosition.mock.calls[0][1]).toBe("b");
  });
  it("drops queued reading when the response moves to another round", async () => {
    const { controller, transport } = setup();
    await controller.reload();
    const response = deferred<ApiLearningProgress>();
    transport.setReadingPosition.mockReturnValueOnce(response.promise);
    const pending = controller.visit("a");
    await controller.visit("b");
    response.resolve({ ...initial, generation: 1 });
    await pending;
    expect(transport.setReadingPosition).toHaveBeenCalledTimes(1);
  });
  it("preserves confirmed progress when reading write and refresh both fail", async () => {
    const { controller, transport, publish } = setup();
    await controller.reload();
    transport.setReadingPosition.mockRejectedValue(new Error("offline"));
    transport.learningProgress.mockRejectedValue(new Error("offline"));
    expect(await controller.visit("b")).toBe(false);
    expect(publish.mock.lastCall?.[0].snapshot).toBe(initial);
    expect(publish.mock.lastCall?.[0].recovery).toBe("retry-sync");
  });
  it("confirms a lost response from a same-round read without another completion write", async () => {
    const { controller, transport, publish } = setup();
    await controller.reload();
    transport.setLessonProgress.mockRejectedValueOnce(new Error("response lost"));
    transport.learningProgress.mockResolvedValueOnce(complete(initial, "a", true));
    expect(await controller.setCompleted("a", true)).toBe(true);
    expect(publish.mock.lastCall?.[0].completion).toMatchObject({ status: "saved", command: { completed: true } });
    expect(transport.setLessonProgress).toHaveBeenCalledTimes(1);
  });
  it("retains a failed target when write and refresh both fail; retry reads before resending", async () => {
    const { controller, transport, publish } = setup();
    await controller.reload();
    transport.setLessonProgress.mockRejectedValueOnce(new Error("offline"));
    transport.learningProgress.mockRejectedValueOnce(new Error("offline"));
    expect(await controller.setCompleted("a", true)).toBe(false);
    expect(publish.mock.lastCall?.[0].snapshot).toBe(initial);
    expect(publish.mock.lastCall?.[0].completion).toMatchObject({ status: "failed", command: { lessonId: "a", completed: true } });
    transport.learningProgress.mockResolvedValueOnce({ ...initial, revision: 8 });
    expect(await controller.recover("a")).toBe(true);
    expect(transport.setLessonProgress.mock.calls.map(call => call[3])).toEqual([true, true]);
    expect(transport.setLessonProgress.mock.calls[1][2].revision).toBe(8);
  });
  it("retry confirms an already applied target instead of toggling or resending it", async () => {
    const { controller, transport, publish } = setup();
    await controller.reload();
    transport.setLessonProgress.mockRejectedValueOnce(new Error("offline"));
    await controller.setCompleted("a", true);
    transport.learningProgress.mockResolvedValueOnce(complete(initial, "a", true));
    expect(await controller.recover("a")).toBe(true);
    expect(transport.setLessonProgress).toHaveBeenCalledTimes(1);
    expect(publish.mock.lastCall?.[0].completion.status).toBe("saved");
  });
  it("retains a failed undo target rather than deriving another toggle", async () => {
    const { controller, transport } = setup();
    transport.learningProgress.mockResolvedValue(complete(initial, "a", true));
    await controller.reload();
    transport.setLessonProgress.mockRejectedValueOnce(new Error("offline"));
    await controller.setCompleted("a", false);
    expect(await controller.recover("a")).toBe(true);
    expect(transport.setLessonProgress.mock.calls.map(call => call[3])).toEqual([false, false]);
  });
  it("refreshes a 409 without automatically replaying the command", async () => {
    const { controller, transport, publish } = setup();
    await controller.reload();
    transport.setLessonProgress.mockRejectedValueOnce(new ApiError(409, "revision changed"));
    transport.learningProgress.mockResolvedValueOnce({ ...initial, revision: 4 });
    expect(await controller.setCompleted("a", true)).toBe(false);
    expect(transport.setLessonProgress).toHaveBeenCalledTimes(1);
    expect(publish.mock.lastCall?.[0].completion.status).toBe("failed");
  });
  it.each([{ generation: 1 }, { courseVersionId: "v2", courseVersion: 2 }, { active: false }])("does not retry into changed ownership %j", async (changed) => {
    const { controller, transport, publish } = setup();
    await controller.reload();
    transport.setLessonProgress.mockRejectedValueOnce(new Error("offline"));
    await controller.setCompleted("a", true);
    transport.learningProgress.mockResolvedValueOnce({ ...initial, ...changed });
    expect(await controller.recover("a")).toBe(false);
    expect(transport.setLessonProgress).toHaveBeenCalledTimes(1);
    expect(publish.mock.lastCall?.[0].completion.status).toBe("idle");
  });
  it("clears saved feedback after another client changes the confirmed target", async () => {
    const { controller, publish } = setup();
    await controller.reload();
    await controller.setCompleted("a", true);
    await controller.reload();
    expect(publish.mock.lastCall?.[0].snapshot.completedLessonIds).toEqual([]);
    expect(publish.mock.lastCall?.[0].completion.status).toBe("idle");
  });
  it("clears old-round feedback after queued reload and ignores disposed results", async () => {
    const { controller, transport, publish } = setup();
    await controller.reload();
    const response = deferred<ApiLearningProgress>();
    transport.setLessonProgress.mockReturnValueOnce(response.promise);
    const pending = controller.setCompleted("a", true);
    await controller.reload();
    transport.learningProgress.mockResolvedValueOnce({ ...initial, generation: 1 });
    response.resolve(complete(initial, "a", true));
    await pending;
    expect(publish.mock.lastCall?.[0].completion.status).toBe("idle");

    const last = deferred<ApiLearningProgress>();
    transport.setLessonProgress.mockReturnValueOnce(last.promise);
    const abandoned = controller.setCompleted("b", true);
    controller.dispose();
    const calls = publish.mock.calls.length;
    last.resolve(complete(initial, "b", true));
    expect(await abandoned).toBe(false);
    expect(publish).toHaveBeenCalledTimes(calls);
  });
  it("reloads the course after a version mismatch and keeps that recovery despite later refresh attempts", async () => {
    const { controller, transport, publish, host } = setup();
    transport.learningProgress.mockResolvedValueOnce({ ...initial, courseVersion: 2, courseVersionId: "v2" });
    await controller.reload();
    expect(publish.mock.lastCall?.[0]).toMatchObject({ snapshot: null, busy: false, recovery: "reload-course", completion: { status: "idle" } });
    transport.learningProgress.mockRejectedValue(new Error("offline after update"));
    await controller.reload();
    expect(await controller.visit("a")).toBe(false);
    expect(await controller.setCompleted("a", true)).toBe(false);
    await controller.recover("");
    expect(host.reloadCourse).toHaveBeenCalledTimes(1);
    expect(transport.learningProgress).toHaveBeenCalledTimes(1);
    expect(transport.setReadingPosition).not.toHaveBeenCalled();
    expect(transport.setLessonProgress).not.toHaveBeenCalled();
    expect(publish.mock.lastCall?.[0].recovery).toBe("reload-course");
    controller.dispose();
    await controller.recover("a");
    expect(host.reloadCourse).toHaveBeenCalledTimes(1);
  });
  it("discards queued reading and focus refresh when an in-flight response reveals a new course version", async () => {
    const { controller, transport, publish } = setup();
    await controller.reload();
    const response = deferred<ApiLearningProgress>();
    transport.setReadingPosition.mockReturnValueOnce(response.promise);
    const pending = controller.visit("a");
    await controller.visit("b");
    await controller.reload();
    response.resolve({ ...initial, courseVersion: 2, courseVersionId: "v2" });
    expect(await pending).toBe(false);
    expect(transport.setReadingPosition).toHaveBeenCalledTimes(1);
    expect(transport.learningProgress).toHaveBeenCalledTimes(1);
    expect(publish.mock.lastCall?.[0].recovery).toBe("reload-course");
  });
  it("prioritizes course reload over a completion retry when confirmation reveals a new version", async () => {
    const { controller, transport, publish, host } = setup();
    await controller.reload();
    transport.setLessonProgress.mockRejectedValueOnce(new ApiError(409, "course changed"));
    transport.learningProgress.mockResolvedValueOnce({ ...initial, courseVersion: 2, courseVersionId: "v2" });
    await controller.setCompleted("a", true);
    expect(publish.mock.lastCall?.[0].completion.status).toBe("idle");
    await controller.recover("a");
    expect(host.reloadCourse).toHaveBeenCalledTimes(1);
    expect(transport.learningProgress).toHaveBeenCalledTimes(2);
    expect(transport.setLessonProgress).toHaveBeenCalledTimes(1);
  });
  it("does not replay A's failed command when recovering a sync failure from B", async () => {
    const { controller, transport, publish } = setup();
    await controller.reload();
    transport.setLessonProgress.mockRejectedValueOnce(new Error("write failed"));
    await controller.setCompleted("a", true);
    transport.learningProgress.mockRejectedValueOnce(new Error("sync failed"));
    await controller.reload();
    expect(publish.mock.lastCall?.[0].recovery).toBe("retry-sync");
    await controller.recover("b");
    expect(transport.setLessonProgress).toHaveBeenCalledTimes(1);
    expect(publish.mock.lastCall?.[0].recovery).toBe("none");
    expect(publish.mock.lastCall?.[0].completion).toMatchObject({ status: "failed", command: { lessonId: "a", completed: true } });
  });
  it("recovers an ordinary initial read failure without a course reload", async () => {
    const { controller, transport, publish, host } = setup();
    transport.learningProgress.mockRejectedValueOnce(new Error("offline"));
    await controller.reload();
    expect(publish.mock.lastCall?.[0].recovery).toBe("retry-sync");
    await controller.recover("");
    expect(publish.mock.lastCall?.[0].recovery).toBe("none");
    expect(publish.mock.lastCall?.[0].snapshot).toEqual(initial);
    expect(transport.learningProgress).toHaveBeenCalledTimes(2);
    expect(host.reloadCourse).not.toHaveBeenCalled();
  });

});
