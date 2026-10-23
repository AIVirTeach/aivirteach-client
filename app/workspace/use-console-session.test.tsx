// @vitest-environment jsdom
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ consoleSession: vi.fn() }));
vi.mock("../lib/api", () => ({ api: apiMock }));

import { useConsoleSession } from "./use-console-session";
import type { ApiWorkspace } from "../lib/api";

const formatError = (error: unknown) => error instanceof Error ? error.message : "failed";
const ticketDeliveries: Array<{ enrollmentId: string; ticket: string | undefined }> = [];
const workspace = (id: string, enrollmentId: string, status: ApiWorkspace["status"] = "RUNNING"): ApiWorkspace => ({
  id, enrollmentId, status, errorMessage: null,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("shared workspace console hook", () => {
  let host: HTMLDivElement;
  let root: Root;

  function Probe({ enrollmentId, currentWorkspace, rerenderCount = 0 }: { enrollmentId: string; currentWorkspace: ApiWorkspace | null; rerenderCount?: number }) {
    const state = useConsoleSession({ enrollmentId, workspace: currentWorkspace, timeoutMessage: "timed out", formatPollError: formatError });
    if (state.session) ticketDeliveries.push({ enrollmentId, ticket: state.session.data });
    return createElement("div", null,
      createElement("button", { onClick: state.start }, "Start"),
      createElement("output", { "data-testid": "state", "data-rerenders": rerenderCount }, state.status),
      state.session && createElement("output", { "data-testid": "ticket-owner" }, `${currentWorkspace?.enrollmentId}:${currentWorkspace?.id}:${state.session.data}`),
    );
  }

  const render = (enrollmentId: string, currentWorkspace: ApiWorkspace | null, rerenderCount = 0) => root.render(createElement(Probe, { enrollmentId, currentWorkspace, rerenderCount }));
  const renderStrict = (enrollmentId: string, currentWorkspace: ApiWorkspace | null) => root.render(createElement(StrictMode, null, createElement(Probe, { enrollmentId, currentWorkspace })));

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.useFakeTimers();
    apiMock.consoleSession.mockReset();
    ticketDeliveries.length = 0;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps one polling owner across rerenders and masks a ready ticket on identity change", async () => {
    const first = deferred<{ state: string; labId: string }>();
    const second = deferred<{ state: string; labId: string; data: string }>();
    apiMock.consoleSession.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await act(async () => render("enrollment-1", workspace("workspace-1", "enrollment-1")));
    await act(async () => { host.querySelector("button")!.click(); });
    expect(apiMock.consoleSession).toHaveBeenCalledTimes(1);
    first.resolve({ state: "starting", labId: "lab-1" });
    await act(async () => {});
    await act(async () => render("enrollment-1", workspace("workspace-1", "enrollment-1"), 1));
    expect(apiMock.consoleSession).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(apiMock.consoleSession).toHaveBeenCalledTimes(2);
    second.resolve({ state: "ready", labId: "lab-1", data: "old-ticket" });
    await act(async () => {});
    expect(host.querySelector('[data-testid="ticket-owner"]')?.textContent).toBe("enrollment-1:workspace-1:old-ticket");

    await act(async () => render("enrollment-2", workspace("workspace-1", "enrollment-1"), 2));
    expect(host.querySelector('[data-testid="ticket-owner"]')).toBeNull();
    expect(host.querySelector('[data-testid="state"]')?.textContent).toBe("idle");
    expect(ticketDeliveries).not.toContainEqual({ enrollmentId: "enrollment-2", ticket: "old-ticket" });
    expect(apiMock.consoleSession).toHaveBeenCalledTimes(2);
  });

  it("invalidates the prior polling run across STOPPED then RUNNING on the same workspace", async () => {
    const previous = deferred<{ state: string; labId: string; data: string }>();
    const resumed = deferred<{ state: string; labId: string; data: string }>();
    apiMock.consoleSession.mockReturnValueOnce(previous.promise).mockReturnValueOnce(resumed.promise);
    await act(async () => render("enrollment-1", workspace("workspace-1", "enrollment-1")));
    await act(async () => { host.querySelector("button")!.click(); });
    await act(async () => render("enrollment-1", workspace("workspace-1", "enrollment-1", "STOPPED")));
    expect(host.querySelector('[data-testid="ticket-owner"]')).toBeNull();
    await act(async () => render("enrollment-1", workspace("workspace-1", "enrollment-1", "RUNNING")));
    await act(async () => { host.querySelector("button")!.click(); });
    resumed.resolve({ state: "ready", labId: "lab-1", data: "resumed-ticket" });
    await act(async () => {});
    previous.resolve({ state: "ready", labId: "lab-old", data: "stale-ticket" });
    await act(async () => {});
    expect(host.querySelector('[data-testid="ticket-owner"]')?.textContent).toBe("enrollment-1:workspace-1:resumed-ticket");
    expect(ticketDeliveries).not.toContainEqual({ enrollmentId: "enrollment-1", ticket: "stale-ticket" });
    expect(apiMock.consoleSession).toHaveBeenCalledTimes(2);
  });

  it("can start a fresh polling run after StrictMode effect replay", async () => {
    const request = deferred<{ state: string; labId: string; data: string }>();
    apiMock.consoleSession.mockReturnValueOnce(request.promise);
    await act(async () => renderStrict("enrollment-1", workspace("workspace-1", "enrollment-1")));
    await act(async () => { host.querySelector("button")!.click(); });
    expect(apiMock.consoleSession).toHaveBeenCalledTimes(1);
    request.resolve({ state: "ready", labId: "lab-1", data: "strict-ticket" });
    await act(async () => {});
    expect(host.querySelector('[data-testid="ticket-owner"]')?.textContent).toBe("enrollment-1:workspace-1:strict-ticket");
  });
});
