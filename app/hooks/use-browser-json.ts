"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("aivirteach-storage-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("aivirteach-storage-change", onChange);
  };
}

function parse<T>(raw: string | null, fallback: T, parseValue: (value: unknown, fallback: T) => T): T {
  if (raw === null) return fallback;
  try { return parseValue(JSON.parse(raw) as unknown, fallback); } catch { return fallback; }
}

export function useBrowserJson<T>(key: string, serverFallback: T, clientFallback: () => T, parseValue: (value: unknown, fallback: T) => T, normalize: (value: T) => T = (value) => value) {
  const getSnapshot = useCallback(() => {
    const value = parse(window.localStorage.getItem(key), clientFallback(), parseValue);
    return JSON.stringify(normalize(value));
  }, [clientFallback, key, normalize, parseValue]);
  const serverSnapshot = useCallback(() => JSON.stringify(serverFallback), [serverFallback]);
  const serialized = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const value = useMemo(() => parse(serialized, serverFallback, parseValue), [parseValue, serialized, serverFallback]);
  const setValue = useCallback((next: T | ((current: T) => T)) => {
    const current = parse(getSnapshot(), serverFallback, parseValue);
    const candidate = typeof next === "function" ? (next as (current: T) => T)(current) : next;
    window.localStorage.setItem(key, JSON.stringify(normalize(candidate)));
    window.dispatchEvent(new Event("aivirteach-storage-change"));
  }, [getSnapshot, key, normalize, parseValue, serverFallback]);
  return [value, setValue] as const;
}
