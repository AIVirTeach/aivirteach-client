"use client";

import { useEffect, useRef } from "react";

interface ConsoleViewerProps {
  wsUrl: string;
  rdpUsername: string;
  rdpPassword: string;
  onError: (message: string) => void;
}

// IronRDP's ConfigBuilder requires a non-empty `destination` (it throws
// "destination has to be specified" otherwise -- verified by reading
// node_modules/@devolutions/iron-remote-desktop/iron-remote-desktop.js).
// In Devolutions' own example app this is the real `host:port` of the RDP
// target, used by their Devolutions Gateway product for HTTP-layer routing.
// In our architecture, routing is done entirely by websockify's TokenFile
// plugin based on a token already embedded in `wsUrl` -- the browser is
// never given the VM's real internal address (server-side
// `ConsoleSessionResult` only returns wsUrl/rdpUsername/rdpPassword/
// expiresAt, no host). So there is no real destination value to pass here.
// Whether IronRDP's RDP-layer handshake itself inspects/uses `destination`
// (rather than treating it purely as Gateway-routing metadata that a raw
// websockify tunnel doesn't need) can only be confirmed against a real xrdp
// target -- deferred to hardware verification (see report).
const RDP_DESTINATION_PLACEHOLDER = "console";

// IronRDP's ConfigBuilder also requires a non-empty `authToken` (throws
// "authentication token has to be specified" otherwise -- same source
// file). It's designed for Devolutions Gateway's JWT-based proxy
// authentication. Our proxy is a plain websockify tunnel whose auth token
// is already embedded in `wsUrl` (passed below as `proxyAddress`), so this
// value only exists to satisfy IronRDP's non-empty-string requirement --
// websockify never sees or checks it. If IronRDP's WASM layer ever starts
// appending `authToken` onto the proxy URL/headers itself (rather than
// treating `proxyAddress` as the complete, final URL), this placeholder
// would need to become meaningful. Unverified against a real xrdp target --
// deferred to hardware verification (see report).
const RDP_AUTH_TOKEN_PLACEHOLDER = "unused";

type IronRemoteDesktopElement = HTMLElement & { module: unknown };

interface SessionTerminationInfo {
  reason(): string;
}

interface NewSessionInfo {
  run(): Promise<SessionTerminationInfo>;
}

interface ConfigBuilder {
  withUsername(username: string): ConfigBuilder;
  withPassword(password: string): ConfigBuilder;
  withProxyAddress(address: string): ConfigBuilder;
  withDestination(destination: string): ConfigBuilder;
  withAuthToken(token: string): ConfigBuilder;
  build(): unknown;
}

interface UserInteraction {
  configBuilder(): ConfigBuilder;
  connect(config: unknown): Promise<NewSessionInfo>;
  setVisibility(state: boolean): void;
  shutdown(): void;
}

interface ReadyEventDetail {
  irgUserInteraction: UserInteraction;
}

function isIronError(error: unknown): error is { backtrace: () => string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "backtrace" in error &&
    typeof (error as { backtrace?: unknown }).backtrace === "function"
  );
}

function messageFromError(error: unknown): string {
  if (isIronError(error)) {
    try {
      return error.backtrace();
    } catch {
      // fall through to generic handling below
    }
  }
  if (error instanceof Error) return error.message;
  return "Could not connect to the remote desktop.";
}

/**
 * Wraps the IronRDP WASM web client (`@devolutions/iron-remote-desktop` +
 * `@devolutions/iron-remote-desktop-rdp`) as a React component. Renders the
 * `<iron-remote-desktop>` custom element imperatively (not via JSX, since
 * that would require augmenting the global JSX.IntrinsicElements typings
 * for one call site) and drives it through the `UserInteraction` handle
 * exposed on its `ready` event.
 */
export function ConsoleViewer({ wsUrl, rdpUsername, rdpPassword, onError }: ConsoleViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let userInteraction: UserInteraction | null = null;
    let element: IronRemoteDesktopElement | null = null;

    async function connect(mountPoint: HTMLDivElement) {
      // Dynamic import: these packages touch `customElements`/WASM, which
      // don't exist during server-side rendering, so they must only load
      // client-side, after mount.
      await import("@devolutions/iron-remote-desktop");
      const { init, Backend } = await import("@devolutions/iron-remote-desktop-rdp");
      if (cancelled) return;

      await init("WARN");
      if (cancelled) return;

      const el = document.createElement("iron-remote-desktop") as IronRemoteDesktopElement;
      el.style.display = "block";
      el.style.width = "100%";
      el.style.height = "100%";
      el.setAttribute("scale", "fit");
      el.setAttribute("verbose", "false");
      // Devolutions' README documents the flex-centering attribute as
      // `flexcentre` (UK spelling), but the actually installed package
      // (0.11.0) defines only `flexcenter` (US spelling) as a real
      // property/attribute -- verified by reading the customElements.define
      // call in node_modules/@devolutions/iron-remote-desktop/
      // iron-remote-desktop.js, which lists exactly: scale, verbose,
      // flexcenter, module. `flexcentre` is not defined at all in this
      // version, so it is intentionally omitted rather than set defensively.
      el.setAttribute("flexcenter", "true");
      // Assigned as a JS property (not an attribute) because it holds an
      // object reference, not a string.
      el.module = Backend;

      element = el;

      el.addEventListener("ready", (evt) => {
        if (cancelled) return;

        const detail = (evt as CustomEvent<ReadyEventDetail>).detail;
        const ui = detail.irgUserInteraction;
        userInteraction = ui;

        const config = ui
          .configBuilder()
          .withUsername(rdpUsername)
          .withPassword(rdpPassword)
          .withProxyAddress(wsUrl)
          .withDestination(RDP_DESTINATION_PLACEHOLDER)
          .withAuthToken(RDP_AUTH_TOKEN_PLACEHOLDER)
          .build();

        ui.connect(config)
          .then((session) => {
            if (cancelled) return undefined;
            ui.setVisibility(true);
            // connect() only completes the initial negotiation. The
            // returned NewSessionInfo.run() must be awaited to actually
            // drive the RDP stream -- it resolves once the session ends
            // (disconnect, VM stop, etc).
            return session.run();
          })
          .then((termination) => {
            if (cancelled || !termination) return;
            onError(`Remote desktop session ended: ${termination.reason()}`);
          })
          .catch((error: unknown) => {
            if (cancelled) return;
            onError(messageFromError(error));
          });
      });

      mountPoint.appendChild(el);
    }

    connect(container).catch((error: unknown) => {
      if (!cancelled) onError(messageFromError(error));
    });

    return () => {
      cancelled = true;
      userInteraction?.shutdown();
      element?.remove();
    };
  }, [wsUrl, rdpUsername, rdpPassword, onError]);

  return <div ref={containerRef} className="console-viewer" />;
}
