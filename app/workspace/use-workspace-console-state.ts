"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiConsoleSession, ApiWorkspace } from "../lib/api";
import { consoleStateAfterLifecycleChange, consoleStateFor, emptyConsoleState, updateConsoleStateIfCurrent, type ConsoleState, type KeyedConsoleState } from "./console-state";

export function useWorkspaceConsoleState(workspace: ApiWorkspace | null) {
  const key = workspace ? `${workspace.id}:${workspace.status}` : "no-workspace";
  const [stored, setStored] = useState<KeyedConsoleState>(null);
  const currentKey = useRef(key);
  useEffect(() => { currentKey.current = key; }, [key]);
  const nextStored = consoleStateAfterLifecycleChange(key, stored);
  if (nextStored !== stored) setStored(nextStored);
  const value = consoleStateFor(key, stored);
  const update = useCallback((change: (current: ConsoleState) => ConsoleState) => {
    setStored((previous) => {
      return updateConsoleStateIfCurrent(currentKey.current, key, previous, change);
    });
  }, [key]);
  const setSession = useCallback((session: ApiConsoleSession | null) => update((current) => ({ ...current, session })), [update]);
  const setError = useCallback((error: string) => update((current) => ({ ...current, error })), [update]);
  const setLoading = useCallback((loading: boolean) => update((current) => ({ ...current, loading })), [update]);
  const clear = useCallback(() => update(() => emptyConsoleState), [update]);
  return {
    ...value,
    setSession,
    setError,
    setLoading,
    clear,
  };
}
