"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { getServerScrollbarPreference, getStoredScrollbarPreference, subscribeToScrollbarPreference } from "../lib/scrollbar-preference";

export function ScrollbarPreference() {
  const preference = useSyncExternalStore(subscribeToScrollbarPreference, getStoredScrollbarPreference, getServerScrollbarPreference);

  useLayoutEffect(() => {
    document.documentElement.dataset.scrollbars = preference;
  }, [preference]);

  return null;
}
