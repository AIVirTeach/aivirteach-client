import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, beaconStopWorkspace } from "./api";

describe("api.stopWorkspace / startWorkspace / workspaceHeartbeat", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("stopWorkspace: POST /workspaces/:id/stop，body 带 reason=manual", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "ws_1", enrollmentId: "enr_1", status: "STOPPED", errorMessage: null }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await api.stopWorkspace("enr_1");

    expect(result.status).toBe("STOPPED");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/workspaces/enr_1/stop");
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse(init.body)).toEqual({ reason: "manual" });
  });

  it("startWorkspace: POST /workspaces/:id/start", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "ws_1", enrollmentId: "enr_1", status: "RUNNING", errorMessage: null }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await api.startWorkspace("enr_1");

    expect(result.status).toBe("RUNNING");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/workspaces/enr_1/start");
    expect(init).toMatchObject({ method: "POST" });
  });

  it("workspaceHeartbeat: POST /workspaces/:id/heartbeat", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "ws_1", enrollmentId: "enr_1", status: "RUNNING", errorMessage: null }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await api.workspaceHeartbeat("enr_1");

    expect(result.status).toBe("RUNNING");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/workspaces/enr_1/heartbeat");
    expect(init).toMatchObject({ method: "POST" });
  });
});

describe("beaconStopWorkspace", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { sendBeacon: vi.fn().mockReturnValue(true) });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("没有 token 时不调用 sendBeacon", () => {
    beaconStopWorkspace("enr_1", null);
    expect(navigator.sendBeacon).not.toHaveBeenCalled();
  });

  it("有 token 时用 sendBeacon 打 /stop?token=...，body 里 reason=beacon", () => {
    beaconStopWorkspace("enr_1", "access-token-123");

    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
    const [url, body] = (navigator.sendBeacon as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("/workspaces/enr_1/stop?token=access-token-123");
    expect(body).toBeInstanceOf(Blob);
    expect((body as Blob).type).toBe("application/json");
  });
});
