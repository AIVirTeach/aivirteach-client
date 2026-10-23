"use client";

import { useCallback, useSyncExternalStore } from "react";

export function parseBrowserNumber(stored: string | null, fallback: number, bounds?: { min: number; max: number }) {
  const value = stored === null ? Number.NaN : Number(stored);
  const valid = Number.isFinite(value) && value >= 0 ? value : fallback;
  return bounds ? Math.min(bounds.max, Math.max(bounds.min, valid)) : valid;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("aivirteach-storage-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("aivirteach-storage-change", onChange);
  };
}

export function useBrowserNumber(key: string, fallback: number, bounds?: { min: number; max: number }) {
  const min = bounds?.min;
  const max = bounds?.max;
  const getSnapshot = useCallback(() => {
    return parseBrowserNumber(window.localStorage.getItem(key), fallback, min !== undefined && max !== undefined ? { min, max } : undefined);
  }, [fallback, key, max, min]);
  const value = useSyncExternalStore(subscribe, getSnapshot, () => fallback);
  const setValue = useCallback((next: number | ((current: number) => number)) => {
    const current = getSnapshot();
    const candidate = typeof next === "function" ? next(current) : next;
    const resolved = min !== undefined && max !== undefined ? Math.min(max, Math.max(min, candidate)) : candidate;
    window.localStorage.setItem(key, String(resolved));
    window.dispatchEvent(new Event("aivirteach-storage-change"));
  }, [getSnapshot, key, max, min]);
  return [value, setValue] as const;
}
