"use client";

import { useCallback, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react";
import { api, type ApiWorkspace } from "../lib/api";
import { ConsoleSessionController, idleConsoleSession } from "./console-session";

type Options = {
  enrollmentId: string | undefined;
  workspace: ApiWorkspace | null;
  timeoutMessage: string;
  formatPollError: (error: unknown) => string;
  onViewerError?: (message: string) => void;
  onPollError?: () => void;
};

export function useConsoleSession({ enrollmentId, workspace, timeoutMessage, formatPollError, onViewerError, onPollError }: Options) {
  const [controller] = useState(() => new ConsoleSessionController({
    requestSession: (id) => api.consoleSession(id),
    onPollError: formatPollError,
    onViewerError: (message) => onViewerError?.(message),
    timeoutMessage,
  }));
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, () => idleConsoleSession);
  const matchingWorkspace = workspace?.enrollmentId === enrollmentId && Boolean(enrollmentId);
  const scope = useMemo(() => matchingWorkspace && workspace ? { enrollmentId: enrollmentId!, workspaceId: workspace.id } : null, [matchingWorkspace, enrollmentId, workspace]);
  const enabled = Boolean(scope && workspace?.status === "RUNNING");
  const currentScopeKey = scope ? `${scope.enrollmentId}:${scope.workspaceId}` : null;
  const state = enabled && currentScopeKey === controller.getStateScopeKey() ? snapshot : idleConsoleSession;

  useLayoutEffect(() => {
    controller.updateOptions({
      requestSession: (id) => api.consoleSession(id),
      onPollError: formatPollError,
      onViewerError: (message) => onViewerError?.(message),
      timeoutMessage,
      afterPollError: () => onPollError?.(),
    });
    controller.bind(scope, enabled);
  }, [controller, scope, enabled, timeoutMessage, formatPollError, onViewerError, onPollError]);

  useLayoutEffect(() => () => controller.deactivate(), [controller]);

  const start = useCallback(() => controller.start(), [controller]);
  const stop = useCallback(() => controller.stop(), [controller]);
  const reportViewerError = useCallback((message: string) => controller.reportViewerError(message), [controller]);

  return {
    session: state.status === "ready" ? state.session : null,
    error: state.status === "error" ? state.error : "",
    loading: state.status === "loading",
    status: state.status,
    start,
    stop,
    reportViewerError,
  };
}
