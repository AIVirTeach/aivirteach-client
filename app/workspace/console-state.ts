import type { ApiConsoleSession } from "../lib/api";

export type ConsoleState = { session: ApiConsoleSession | null; error: string; loading: boolean };
export type KeyedConsoleState = { key: string; value: ConsoleState } | null;
export const emptyConsoleState: ConsoleState = { session: null, error: "", loading: false };

export function consoleStateFor(key: string, stored: KeyedConsoleState) {
  return stored?.key === key ? stored.value : emptyConsoleState;
}

export function consoleStateAfterLifecycleChange(key: string, stored: KeyedConsoleState): KeyedConsoleState {
  return stored?.key === key ? stored : null;
}

export function updateConsoleState(key: string, previous: KeyedConsoleState, change: (current: ConsoleState) => ConsoleState): KeyedConsoleState {
  const current = consoleStateFor(key, previous);
  return { key, value: change(current) };
}

export function updateConsoleStateIfCurrent(currentKey: string, key: string, previous: KeyedConsoleState, change: (current: ConsoleState) => ConsoleState): KeyedConsoleState {
  return currentKey === key ? updateConsoleState(key, previous, change) : previous;
}
