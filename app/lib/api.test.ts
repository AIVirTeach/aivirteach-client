import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, beaconStopWorkspace } from "./api";
import { API_BASE_URL } from "./config";

describe("api.lesson", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("loads published lesson content from the course API", async () => {
    const lesson = { courseId: "a/b", courseVersionId: "cv-1", courseVersion: 3, lesson: { id: "step one" }, blocks: [], assets: {}, markdown: "legacy" };
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(lesson), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await api.lesson("a/b", "step one")).toEqual(lesson);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/courses/a%2Fb/lessons/step%20one`);
  });
});

describe("api.chatMessages", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads chat history for the requested enrollment generation", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await api.chatMessages("enrollment/1", 7);

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/workspaces/enrollment%2F1/chat/messages?generation=7`);
  });
});

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
    const command = { requestId: "c9a91c1d-e1f8-43d8-9ffc-946686d4168f", text: "你好", context: { courseVersionId: "cv-1", lessonId: "lesson-1", generation: 4 } };

    const response = await api.streamChatMessage("enroll-1", command);

    expect(fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/workspaces/enroll-1/chat/messages/stream`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(command),
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

    await expect(api.streamChatMessage("enroll-1", { requestId: "c9a91c1d-e1f8-43d8-9ffc-946686d4168f", text: "你好", context: { courseVersionId: "cv-1", lessonId: "lesson-1", generation: 4 } })).rejects.toBeInstanceOf(ApiError);
  });

  it("传入 AbortSignal 时透传给 fetch，调用方可以中止还没读完的流", async () => {
    const body = new ReadableStream();
    vi.mocked(fetch).mockResolvedValue(new Response(body, { status: 200 }));
    const controller = new AbortController();
    const command = { requestId: "c9a91c1d-e1f8-43d8-9ffc-946686d4168f", text: "你好", context: { courseVersionId: "cv-1", lessonId: "lesson-1", generation: 4 } };

    await api.streamChatMessage("enroll-1", command, controller.signal);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("non-stream chat posts the same typed command and forwards cancellation", async () => {
    const command = { requestId: "c9a91c1d-e1f8-43d8-9ffc-946686d4168f", text: "你好", context: { courseVersionId: "cv-1", lessonId: "lesson-1", generation: 4 } };
    const controller = new AbortController();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ studentMessage: {}, tutorMessage: {} }), { status: 200 }));

    await api.sendChatMessage("enroll-1", command, controller.signal);

    expect(fetch).toHaveBeenCalledWith(`${API_BASE_URL}/workspaces/enroll-1/chat/messages`, expect.objectContaining({
      method: "POST",
      body: JSON.stringify(command),
      signal: controller.signal,
    }));
  });
});
