import { describe, expect, it, vi } from "vitest";
import type { ApiLearningProgress } from "../lib/api";
import { createLearningProgressController } from "./learning-progress-controller";
const initial: ApiLearningProgress = { enrollmentId: 'e', courseId: 'c', generation: 0, revision: 0, courseVersionId: 'v1', courseVersion: 1, active: true, completedLessonIds: [], totalLessons: 2, currentLessonId: null, nextLessonId: 'a', progressPercent: 0, status: 'in_progress', achievements: [] };
function setup() {
  const transport = { learningProgress: vi.fn().mockResolvedValue(initial), setReadingPosition: vi.fn().mockResolvedValue({ ...initial, currentLessonId: 'b' }), setLessonProgress: vi.fn().mockResolvedValue({ ...initial, revision: 1, completedLessonIds: ['b'], progressPercent: 50 }) };
  const publish = vi.fn();
  return { transport, publish, controller: createLearningProgressController('c', 1, transport, publish) };
}
describe('shared V1/V2 learning progress owner', () => {
  it('reading writes only a reading position; marking uses the returned revision', async () => {
    const { controller, transport, publish } = setup();
    await controller.reload();
    await controller.visit('b');
    expect(transport.setLessonProgress).not.toHaveBeenCalled();
    await controller.setCompleted('b', true);
    expect(publish.mock.lastCall?.[0].snapshot.completedLessonIds).toEqual(['b']);
    await controller.setCompleted('b', false);
    expect(transport.setLessonProgress.mock.lastCall?.[2].revision).toBe(1);
    expect(transport.setLessonProgress.mock.lastCall?.[3]).toBe(false);
  });
  it('blocks duplicate clicks and focus refresh while a write is pending', async () => {
    const { controller, transport } = setup();
    await controller.reload();
    let resolve!: (state: ApiLearningProgress) => void;
    transport.setLessonProgress.mockReturnValue(new Promise<ApiLearningProgress>(r => { resolve = r; }));
    const pending = controller.setCompleted('b', true);
    expect(await controller.setCompleted('a', true)).toBe(false);
    await controller.reload();
    expect(transport.learningProgress).toHaveBeenCalledTimes(1);
    resolve({ ...initial, revision: 1 });
    await pending;
  });
  it('reloads a conflict without automatically replaying stale intent', async () => {
    const { controller, transport, publish } = setup();
    await controller.reload();
    transport.setLessonProgress.mockRejectedValue(new Error('409'));
    transport.learningProgress.mockResolvedValue({ ...initial, generation: 1 });
    expect(await controller.setCompleted('b', true)).toBe(false);
    expect(transport.setLessonProgress).toHaveBeenCalledTimes(1);
    expect(publish.mock.lastCall?.[0].snapshot.generation).toBe(1);
    expect(publish.mock.lastCall?.[0].error).toBeTruthy();
  });
  it('clears writable snapshot if refresh after an uncertain write fails', async () => {
    const { controller, transport, publish } = setup();
    await controller.reload();
    transport.setLessonProgress.mockRejectedValue(new Error('offline'));
    transport.learningProgress.mockRejectedValue(new Error('offline'));
    await controller.setCompleted('a', true);
    expect(publish.mock.lastCall?.[0].snapshot).toBeNull();
    expect(await controller.setCompleted('a', true)).toBe(false);
  });
  it('blocks writes when the server publishes a newer syllabus than the visible course', async () => {
    const { controller, transport, publish } = setup();
    transport.learningProgress.mockResolvedValue({ ...initial, courseVersion: 2 });
    await controller.reload();
    expect(publish.mock.lastCall?.[0].snapshot).toBeNull();
    expect(await controller.setCompleted('a', true)).toBe(false);
    expect(transport.setLessonProgress).not.toHaveBeenCalled();
  });
  it('drops responses after switching course or unmounting', async () => {
    const { controller, transport, publish } = setup();
    let resolve!: (state: ApiLearningProgress) => void;
    transport.learningProgress.mockReturnValue(new Promise<ApiLearningProgress>(r => { resolve = r; }));
    const pending = controller.reload();
    controller.dispose();
    const count = publish.mock.calls.length;
    resolve(initial);
    await pending;
    expect(publish).toHaveBeenCalledTimes(count);
  });
});
