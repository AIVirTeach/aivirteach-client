"use client";

import { useEffect, useRef } from "react";
import Guacamole from "guacamole-common-js";
import { api } from "../lib/api";

interface ConsoleViewerProps {
  data: string;
  labId: string;
  enrollmentId: string;
  onError: (message: string) => void;
}

/**
 * Wraps the Guacamole web client (`guacamole-common-js`) as a React
 * component. `data` is the opaque, encrypted Guacamole JSON-auth ticket
 * minted by Labs. Guacamole's `/api/tokens` doesn't send CORS headers, so
 * the browser can't fetch it directly cross-origin; `api.exchangeConsoleToken`
 * routes that exchange through our own server (server-to-server, no CORS)
 * instead. The WebSocket tunnel itself isn't subject to CORS, so it connects
 * straight to the address the server returns.
 */
export function ConsoleViewer({ data, labId, enrollmentId, onError }: ConsoleViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<Guacamole.Client | null>(null);

  async function syncClipboardToVm() {
    const guacClient = clientRef.current;
    if (!guacClient) return;
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return;
    }
    if (!text) return;
    const stream = guacClient.createClipboardStream("text/plain");
    const writer = new Guacamole.StringWriter(stream);
    writer.sendText(text);
    writer.sendEnd();
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let client: Guacamole.Client | null = null;
    let keyboard: Guacamole.Keyboard | null = null;

    async function connect(mountPoint: HTMLDivElement) {
      const { authToken, websocketUrl } = await api.exchangeConsoleToken(enrollmentId, data);
      if (cancelled) return;

      const tunnel = new Guacamole.WebSocketTunnel(websocketUrl);
      const guacClient = new Guacamole.Client(tunnel);
      client = guacClient;
      clientRef.current = guacClient;

      guacClient.onerror = (status) => {
        if (cancelled) return;
        onError(status.message || "远程桌面连接出错");
      };
      tunnel.onerror = (status) => {
        if (cancelled) return;
        onError(status.message || "无法连接远程桌面服务");
      };

      // 剪贴板同步：远程 -> 本地（从 VM 里复制出来）。
      guacClient.onclipboard = (stream, mimetype) => {
        if (mimetype !== "text/plain") return;
        const reader = new Guacamole.StringReader(stream);
        let text = "";
        reader.ontext = (chunk) => {
          text += chunk;
        };
        reader.onend = () => {
          navigator.clipboard.writeText(text).catch(() => {});
        };
      };

      const display = guacClient.getDisplay();
      mountPoint.appendChild(display.getElement());

      // Mouse (unlike Keyboard below) uses guacamole-common-js's newer
      // Event.Target API (on/onEach), not direct onmousedown-style property
      // assignment -- confirmed from the type declarations' own JSDoc example.
      const mouse = new Guacamole.Mouse(display.getElement());
      mouse.onEach(["mousedown", "mousemove", "mouseup"], (event) => {
        guacClient.sendMouseState((event as Guacamole.Mouse.Event).state, true);
      });

      // 绑定到控制台自己的容器（而不是 document），跟下面的 Mouse 一样只在
      // 这个元素拿到焦点时才会经浏览器的事件路径收到按键——避免抢走页面其它
      // 输入框（比如右侧 AI 助教聊天框）的键盘事件。
      keyboard = new Guacamole.Keyboard(mountPoint);
      keyboard.onkeydown = (keysym) => {
        guacClient.sendKeyEvent(1, keysym);
      };
      keyboard.onkeyup = (keysym) => {
        guacClient.sendKeyEvent(0, keysym);
      };
      mountPoint.focus();

      // 连接参数的具体 key 名/取值以 Task 1 spike 实测结果为准（非本文件设计阶段假设）：
      // GUAC_ID 必须等于 Labs 加密票据里 connections 字典的 key，实测就是 labId 本身
      // （见设计文档第 23 行 "connections: {<lab_id>: {...}}"）；GUAC_WIDTH/HEIGHT/DPI
      // 是 spike 里实测出桌面能正常渲染出画面的固定取值，保守起见沿用。
      const connectParams = new URLSearchParams({
        token: authToken,
        GUAC_DATA_SOURCE: "json",
        GUAC_ID: labId,
        GUAC_TYPE: "c",
        GUAC_WIDTH: "1024",
        GUAC_HEIGHT: "768",
        GUAC_DPI: "96",
      });
      guacClient.connect(connectParams.toString());
    }

    connect(container).catch((error: unknown) => {
      if (!cancelled) onError(error instanceof Error ? error.message : "无法连接远程桌面");
    });

    return () => {
      cancelled = true;
      if (keyboard) {
        keyboard.onkeydown = null;
        keyboard.onkeyup = null;
        keyboard.reset();
      }
      client?.disconnect();
      clientRef.current = null;
      if (container) container.innerHTML = "";
    };
  }, [data, labId, enrollmentId, onError]);

  return (
    <div className="console-viewer-wrap">
      <div ref={containerRef} className="console-viewer" tabIndex={0} aria-label="Remote desktop console" />
      {/* Guacamole.Keyboard 会对转发给远程的按键调用 preventDefault（包括 Ctrl/Cmd+V），
          这会连带压掉浏览器原生的 paste 事件，导致 VM 里只收到裸的 "v" 按键、收不到剪贴板
          内容。所以本地 -> 远程走一个显式按钮（真实用户手势，navigator.clipboard.readText()
          才会被允许），同步后在 VM 里用它自己的粘贴快捷键（Linux 终端一般是 Ctrl+Shift+V）粘贴。 */}
      <button type="button" className="console-viewer-paste-button" onClick={syncClipboardToVm}>
        同步剪贴板到 VM
      </button>
    </div>
  );
}
