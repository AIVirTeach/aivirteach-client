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
  it('keeps navigation responsive and writes only the latest queued reading position', async () => {
    const { controller, transport, publish } = setup();
    await controller.reload();
    let resolve!: (state: ApiLearningProgress) => void;
    transport.setReadingPosition.mockReturnValueOnce(new Promise<ApiLearningProgress>(r => { resolve = r; }));

    const firstVisit = controller.visit('a');
    expect(await controller.visit('b')).toBe(false);
    expect(await controller.visit('c')).toBe(false);
    expect(transport.setReadingPosition).toHaveBeenCalledTimes(1);
    resolve({ ...initial, revision: 1, currentLessonId: 'a' });
    await firstVisit;

    expect(transport.setReadingPosition).toHaveBeenCalledTimes(2);
    expect(transport.setReadingPosition.mock.calls[1][1]).toBe('c');
    expect(publish.mock.lastCall?.[0].snapshot?.currentLessonId).toBe('b');
    expect(publish.mock.lastCall?.[0].busy).toBe(false);
  });
  it('drains queued navigation after a requested refresh when the generation remains current', async () => {
    const { controller, transport } = setup();
    await controller.reload();
    let resolve!: (state: ApiLearningProgress) => void;
    transport.setReadingPosition.mockReturnValueOnce(new Promise<ApiLearningProgress>(r => { resolve = r; }));

    const pending = controller.visit('a');
    await controller.visit('b');
    await controller.reload();
    resolve({ ...initial, revision: 1, currentLessonId: 'a' });
    await pending;

    expect(transport.learningProgress).toHaveBeenCalledTimes(2);
    expect(transport.setReadingPosition.mock.calls.map(call => call[1])).toEqual(['a', 'b']);
  });
  it('drains a visit queued while a direct progress reload is pending', async () => {
    const { controller, transport } = setup();
    await controller.reload();
    let resolve!: (state: ApiLearningProgress) => void;
    transport.learningProgress.mockReturnValueOnce(new Promise<ApiLearningProgress>(r => { resolve = r; }));

    const refresh = controller.reload();
    expect(await controller.visit('b')).toBe(false);
    resolve(initial);
    await refresh;

    expect(transport.setReadingPosition).toHaveBeenCalledTimes(1);
    expect(transport.setReadingPosition.mock.calls[0][1]).toBe('b');
  });
  it('drops queued navigation when the write returns a new generation', async () => {
    const { controller, transport } = setup();
    await controller.reload();
    let resolve!: (state: ApiLearningProgress) => void;
    transport.setReadingPosition.mockReturnValueOnce(new Promise<ApiLearningProgress>(r => { resolve = r; }));

    const pending = controller.visit('a');
    await controller.visit('b');
    resolve({ ...initial, generation: 1, revision: 0, currentLessonId: 'a' });
    await pending;

    expect(transport.setReadingPosition).toHaveBeenCalledTimes(1);
  });
  it('preserves the last confirmed snapshot when reading save and refresh both fail', async () => {
    const { controller, transport, publish } = setup();
    await controller.reload();
    transport.setReadingPosition.mockRejectedValue(new Error('offline'));
    transport.learningProgress.mockRejectedValue(new Error('offline'));

    expect(await controller.visit('b')).toBe(false);

    expect(publish.mock.lastCall?.[0].snapshot).toBe(initial);
    expect(publish.mock.lastCall?.[0].error).toBeTruthy();
    expect(publish.mock.lastCall?.[0].busy).toBe(false);
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
