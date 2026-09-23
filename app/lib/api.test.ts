import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, beaconStopWorkspace } from "./api";
import { API_BASE_URL } from "./config";

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

describe("api.streamChatMessage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POST 到 /workspaces/:enrollmentId/chat/messages/stream，带上 text 和 SSE Accept 头", async () => {
    const body = new ReadableStream();
    vi.mocked(fetch).mockResolvedValue(new Response(body, { status: 200 }));

    const response = await api.streamChatMessage("enroll-1", "你好");

    expect(fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/workspaces/enroll-1/chat/messages/stream`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "你好" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        }),
      }),
    );
    expect(response.body).toBe(body);
  });

  it("非 2xx 响应时抛出 ApiError，而不是把错误响应体当成流返回", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "请先启动虚拟机后再提问。" }), { status: 400 }),
    );

    await expect(api.streamChatMessage("enroll-1", "你好")).rejects.toBeInstanceOf(ApiError);
  });
});
