"use client";

import { useEffect, useRef } from "react";
import Guacamole from "guacamole-common-js";

interface ConsoleViewerProps {
  data: string;
  labId: string;
  guacamoleBaseUrl: string;
  onError: (message: string) => void;
}

function toWebSocketBase(httpBaseUrl: string): string {
  return httpBaseUrl.replace(/^http/, "ws");
}

/**
 * Wraps the Guacamole web client (`guacamole-common-js`) as a React
 * component. `data` is the opaque, encrypted Guacamole JSON-auth ticket
 * minted by Labs; this component exchanges it for a real Guacamole
 * authToken, then opens a WebSocket tunnel directly to Guacamole.
 */
export function ConsoleViewer({ data, labId, guacamoleBaseUrl, onError }: ConsoleViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let client: Guacamole.Client | null = null;
    let keyboard: Guacamole.Keyboard | null = null;

    async function connect(mountPoint: HTMLDivElement) {
      const tokenResponse = await fetch(`${guacamoleBaseUrl}api/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data }),
      });
      if (cancelled) return;
      if (!tokenResponse.ok) {
        throw new Error(`无法建立远程桌面会话（${tokenResponse.status}）`);
      }
      const tokenBody = (await tokenResponse.json()) as { authToken: string };

      const tunnel = new Guacamole.WebSocketTunnel(`${toWebSocketBase(guacamoleBaseUrl)}websocket-tunnel`);
      const guacClient = new Guacamole.Client(tunnel);
      client = guacClient;

      guacClient.onerror = (status) => {
        if (cancelled) return;
        onError(status.message || "远程桌面连接出错");
      };
      tunnel.onerror = (status) => {
        if (cancelled) return;
        onError(status.message || "无法连接远程桌面服务");
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

      keyboard = new Guacamole.Keyboard(document);
      keyboard.onkeydown = (keysym) => {
        guacClient.sendKeyEvent(1, keysym);
      };
      keyboard.onkeyup = (keysym) => {
        guacClient.sendKeyEvent(0, keysym);
      };

      // 连接参数的具体 key 名/取值以 Task 1 spike 实测结果为准（非本文件设计阶段假设）：
      // GUAC_ID 必须等于 Labs 加密票据里 connections 字典的 key，实测就是 labId 本身
      // （见设计文档第 23 行 "connections: {<lab_id>: {...}}"）；GUAC_WIDTH/HEIGHT/DPI
      // 是 spike 里实测出桌面能正常渲染出画面的固定取值，保守起见沿用。
      const connectParams = new URLSearchParams({
        token: tokenBody.authToken,
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
      if (container) container.innerHTML = "";
    };
  }, [data, labId, guacamoleBaseUrl, onError]);

  return <div ref={containerRef} className="console-viewer" />;
}
