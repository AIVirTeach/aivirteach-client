export type ScrollbarPreference = "visible" | "hidden";

const scrollbarStorageKey = "aivirteach.scrollbars";
const scrollbarChangeEvent = "aivirteach:scrollbars-change";

export function getStoredScrollbarPreference(): ScrollbarPreference {
  return window.localStorage.getItem(scrollbarStorageKey) === "hidden" ? "hidden" : "visible";
}

export function getServerScrollbarPreference(): ScrollbarPreference {
  return "visible";
}

export function subscribeToScrollbarPreference(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(scrollbarChangeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(scrollbarChangeEvent, callback);
  };
}

export function applyScrollbarPreference(preference: ScrollbarPreference) {
  document.documentElement.dataset.scrollbars = preference;
  window.localStorage.setItem(scrollbarStorageKey, preference);
  window.dispatchEvent(new Event(scrollbarChangeEvent));
}
