// @vitest-environment jsdom
import { act, createElement, createRef, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const guac = vi.hoisted(() => {
  type FakeClient = {
    onstatechange: ((state: number) => void) | null;
    onerror: ((status: { message: string }) => void) | null;
    onclipboard: ((stream: unknown, mimetype: string) => void) | null;
  };
  type FakeReader = { ontext: ((text: string) => void) | null; onend: (() => void) | null };
  const calls = { exchanges: 0, connects: 0, disconnects: 0, clipboardWrites: 0, clients: [] as FakeClient[], readers: [] as FakeReader[], deferExchanges: false, exchangeResolvers: [] as Array<(value: { authToken: string; websocketUrl: string }) => void> };
  class WebSocketTunnel {
    onerror: ((status: { message: string }) => void) | null = null;
    constructor() {}
  }
  class Client {
    static State = { CONNECTED: 3 };
    onstatechange: ((state: number) => void) | null = null;
    onerror: ((status: { message: string }) => void) | null = null;
    onclipboard: ((stream: unknown, mimetype: string) => void) | null = null;
    constructor() { calls.clients.push(this); }
    connect() { calls.connects += 1; }
    disconnect() { calls.disconnects += 1; }
    getDisplay() {
      return { getElement: () => document.createElement("div"), getWidth: () => 0, getHeight: () => 0, scale: () => undefined };
    }
    createClipboardStream() { return {}; }
    sendMouseState() {}
    sendKeyEvent() {}
  }
  class Keyboard {
    onkeydown: ((keysym: number) => void) | null = null;
    onkeyup: ((keysym: number) => void) | null = null;
    constructor() {}
    reset() {}
  }
  class Mouse {
    constructor() {}
    onEach() {}
  }
  class StringWriter {
    constructor() {}
    sendText() { calls.clipboardWrites += 1; }
    sendEnd() {}
  }
  class StringReader {
    ontext: ((text: string) => void) | null = null;
    onend: (() => void) | null = null;
    constructor() { calls.readers.push(this); }
  }
  return { calls, WebSocketTunnel, Client, Keyboard, Mouse, StringWriter, StringReader };
});

vi.mock("guacamole-common-js", () => ({ default: guac }));
vi.mock("../lib/api", () => ({
  api: {
    exchangeConsoleToken: vi.fn(async () => {
      guac.calls.exchanges += 1;
      if (guac.calls.deferExchanges) return new Promise<{ authToken: string; websocketUrl: string }>((resolve) => guac.calls.exchangeResolvers.push(resolve));
      return { authToken: "auth", websocketUrl: "wss://example.test" };
    }),
  },
}));

import { ConsoleViewer, type ConsoleViewerHandle } from "./console-viewer";

describe("ConsoleViewer mounted connection lifecycle", () => {
  let host: HTMLDivElement;
  let root: Root;
  let mounted = true;
  const observe = vi.fn();
  const disconnectObserver = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    guac.calls.exchanges = 0;
    guac.calls.connects = 0;
    guac.calls.disconnects = 0;
    guac.calls.clipboardWrites = 0;
    guac.calls.clients = [];
    guac.calls.readers = [];
    guac.calls.deferExchanges = false;
    guac.calls.exchangeResolvers = [];
    vi.stubGlobal("ResizeObserver", class {
      observe = observe;
      disconnect = disconnectObserver;
    });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    mounted = true;
  });

  afterEach(async () => {
    if (mounted) await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  it("keeps one physical connection when only the error callback changes", async () => {
    const firstError = vi.fn();
    const latestError = vi.fn();
    const viewerRef = createRef<ConsoleViewerHandle>();
    const render = (onError: (message: string) => void) => createElement(ConsoleViewer, {
      ref: viewerRef, data: "ticket", labId: "lab-1", enrollmentId: "enrollment-1", onError,
    });

    await act(async () => root.render(render(firstError)));
    await act(async () => {});
    await act(async () => root.render(render(latestError)));

    expect(guac.calls.exchanges).toBe(1);
    expect(guac.calls.connects).toBe(1);
    expect(guac.calls.disconnects).toBe(0);
    expect(viewerRef.current?.writeClipboard("latest clipboard")).toBe(true);
    const connected = guac.calls.clients[0].onstatechange;
    if (!connected) throw new Error("The Guacamole client has no state callback.");
    connected(guac.Client.State.CONNECTED);
    expect(guac.calls.clipboardWrites).toBe(1);
    const onerror = guac.calls.clients[0].onerror;
    if (!onerror) throw new Error("The Guacamole client has no error callback.");
    onerror({ message: "late current error" });
    expect(firstError).not.toHaveBeenCalled();
    expect(latestError).toHaveBeenCalledWith("late current error");
  });

  it("disconnects once when connection identity changes and once more on unmount", async () => {
    const render = (data: string) => createElement(ConsoleViewer, {
      data, labId: "lab-1", enrollmentId: "enrollment-1", onError: vi.fn(),
    });
    await act(async () => root.render(render("ticket-1")));
    await act(async () => {});
    await act(async () => root.render(render("ticket-2")));
    await act(async () => {});
    expect(guac.calls.exchanges).toBe(2);
    expect(guac.calls.connects).toBe(2);
    expect(guac.calls.disconnects).toBe(1);
    await act(async () => root.unmount());
    mounted = false;
    expect(guac.calls.disconnects).toBe(2);
  });

  it("does not let an old token exchange create a connection after the ticket changes", async () => {
    guac.calls.deferExchanges = true;
    const render = (data: string) => createElement(ConsoleViewer, {
      data, labId: "lab-1", enrollmentId: "enrollment-1", onError: vi.fn(),
    });
    await act(async () => root.render(render("old-ticket")));
    await act(async () => root.render(render("new-ticket")));
    expect(guac.calls.exchanges).toBe(2);
    expect(guac.calls.disconnects).toBe(0);

    await act(async () => guac.calls.exchangeResolvers[1]({ authToken: "new", websocketUrl: "wss://new" }));
    await act(async () => guac.calls.exchangeResolvers[0]({ authToken: "old", websocketUrl: "wss://old" }));
    expect(guac.calls.connects).toBe(1);
    expect(guac.calls.clients).toHaveLength(1);
  });

  it("does not apply a clipboard read started for the previous ticket to the new connection", async () => {
    let finishRead!: (value: string) => void;
    const clipboard = { readText: () => new Promise<string>((resolve) => { finishRead = resolve; }), writeText: vi.fn(async () => undefined) };
    const previousClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
    const render = (data: string) => createElement(ConsoleViewer, {
      data, labId: "lab-1", enrollmentId: "enrollment-1", onError: vi.fn(),
    });
    await act(async () => root.render(render("ticket-1")));
    await act(async () => {});
    await act(async () => { host.querySelector(".console-viewer-paste-button")?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    await act(async () => root.render(render("ticket-2")));
    await act(async () => {});
    finishRead("clipboard from old VM");
    await act(async () => {});
    const connected = guac.calls.clients[1].onstatechange;
    if (!connected) throw new Error("The Guacamole client has no state callback.");
    connected(guac.Client.State.CONNECTED);
    expect(guac.calls.clipboardWrites).toBe(0);
    expect(clipboard.writeText).not.toHaveBeenCalled();
    if (previousClipboard) Object.defineProperty(navigator, "clipboard", previousClipboard);
    else Reflect.deleteProperty(navigator, "clipboard");
  });

  it("ignores SDK callbacks retained by a replaced connection", async () => {
    const oldError = vi.fn();
    const currentError = vi.fn();
    const clipboard = { readText: vi.fn(async () => ""), writeText: vi.fn(async () => undefined) };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
    const render = (data: string, onError: (message: string) => void) => createElement(ConsoleViewer, {
      data, labId: "lab-1", enrollmentId: "enrollment-1", onError,
    });
    await act(async () => root.render(render("ticket-1", oldError)));
    await act(async () => {});
    const staleClient = guac.calls.clients[0];
    const onclipboard = staleClient.onclipboard;
    if (!onclipboard) throw new Error("The Guacamole client has no clipboard callback.");
    onclipboard({}, "text/plain");
    const staleReader = guac.calls.readers[0];
    await act(async () => root.render(render("ticket-2", currentError)));
    await act(async () => {});
    const onerror = staleClient.onerror;
    if (!onerror) throw new Error("The replaced Guacamole client has no error callback.");
    onerror({ message: "stale error" });
    const onstatechange = staleClient.onstatechange;
    if (!onstatechange) throw new Error("The replaced Guacamole client has no state callback.");
    onstatechange(guac.Client.State.CONNECTED);
    if (!staleReader) throw new Error("The text clipboard stream was not read.");
    staleReader.ontext?.("stale clipboard");
    staleReader.onend?.();
    expect(oldError).not.toHaveBeenCalled();
    expect(currentError).not.toHaveBeenCalled();
    expect(clipboard.writeText).not.toHaveBeenCalled();
    expect(guac.calls.clipboardWrites).toBe(0);
  });

  it("leaves one effective connection under React StrictMode effect replay", async () => {
    const element = createElement(StrictMode, null, createElement(ConsoleViewer, {
      data: "ticket", labId: "lab-1", enrollmentId: "enrollment-1", onError: vi.fn(),
    }));
    await act(async () => root.render(element));
    await act(async () => {});
    expect(guac.calls.connects).toBe(1);
    expect(guac.calls.clients).toHaveLength(1);
  });
});
