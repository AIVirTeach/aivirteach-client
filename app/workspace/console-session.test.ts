import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiConsoleSession } from "../lib/api";
import { ConsoleSessionController } from "./console-session";

const scope = { enrollmentId: "enrollment-1", workspaceId: "workspace-1" };
const ready = { state: "ready", labId: "lab-1", data: "ticket" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("ConsoleSessionController", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps a single delayed polling chain and stops on a request error", async () => {
    vi.useFakeTimers();
    const requests: Array<ReturnType<typeof deferred<ApiConsoleSession>>> = [];
    const onPollError = vi.fn(() => "safe error");
    const afterPollError = vi.fn();
    const controller = new ConsoleSessionController({
      requestSession: vi.fn(() => {
        const request = deferred<ApiConsoleSession>();
        requests.push(request);
        return request.promise;
      }),
      onPollError,
      onViewerError: vi.fn(),
      timeoutMessage: "timeout",
      afterPollError,
    });
    controller.bind(scope, true);
    controller.start();
    expect(requests).toHaveLength(1);
    requests[0].resolve({ state: "starting", labId: "lab-1" });
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2500);
    expect(requests).toHaveLength(2);
    requests[1].reject(new Error("upstream detail"));
    await Promise.resolve();
    expect(controller.getSnapshot()).toEqual({ status: "error", error: "safe error" });
    expect(afterPollError).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(requests).toHaveLength(2);
  });

  it("invalidates late responses across stop and resume for the same workspace", async () => {
    const oldRequest = deferred<ApiConsoleSession>();
    const newRequest = deferred<ApiConsoleSession>();
    const requestSession = vi.fn().mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
    const controller = new ConsoleSessionController({
      requestSession,
      onPollError: () => "error",
      onViewerError: vi.fn(),
      timeoutMessage: "timeout",
    });
    controller.bind(scope, true);
    controller.start();
    controller.bind(scope, false);
    controller.bind(scope, true);
    controller.start();
    oldRequest.resolve(ready);
    await Promise.resolve();
    expect(controller.getSnapshot()).toEqual({ status: "loading" });
    newRequest.resolve(ready);
    await Promise.resolve();
    expect(controller.getSnapshot()).toEqual({ status: "ready", session: ready });
  });

  it("ends ownership at the deadline and ignores its late response", async () => {
    vi.useFakeTimers();
    const request = deferred<ApiConsoleSession>();
    const controller = new ConsoleSessionController({
      requestSession: () => request.promise,
      onPollError: () => "error",
      onViewerError: vi.fn(),
      timeoutMessage: "timed out",
    });
    controller.bind(scope, true);
    controller.start();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(controller.getSnapshot()).toEqual({ status: "error", error: "timed out" });
    request.resolve(ready);
    await Promise.resolve();
    expect(controller.getSnapshot()).toEqual({ status: "error", error: "timed out" });
  });

  it("disposes timers and async ownership when unmounted", async () => {
    vi.useFakeTimers();
    const request = deferred<ApiConsoleSession>();
    const controller = new ConsoleSessionController({
      requestSession: () => request.promise,
      onPollError: () => "error",
      onViewerError: vi.fn(),
      timeoutMessage: "timed out",
    });
    controller.bind(scope, true);
    controller.start();
    controller.deactivate();
    request.resolve(ready);
    await Promise.resolve();
    expect(controller.getSnapshot()).toEqual({ status: "idle" });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(controller.getSnapshot()).toEqual({ status: "idle" });
  });
});
