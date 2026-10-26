export type InterfaceVersion = "v1" | "v2" | "soft" | "soft-brutal" | "brutal" | "neubrutal";

import { getCommittedInterfaceVersion } from "./site-ui-customization";

const versionStorageKey = "aivir-interface-version";
const previewStorageKey = "aivir-interface-version-preview";
const versionChangeEvent = "aivirteach:interface-version-change";

export function getStoredInterfaceVersion(): InterfaceVersion {
  const storedVersion = window.sessionStorage.getItem(previewStorageKey) ?? window.localStorage.getItem(versionStorageKey);
  return storedVersion === "v1" || storedVersion === "v2" || storedVersion === "soft" || storedVersion === "soft-brutal" || storedVersion === "brutal" || storedVersion === "neubrutal" ? storedVersion : getCommittedInterfaceVersion();
}

export function getServerInterfaceVersion(): InterfaceVersion {
  return getCommittedInterfaceVersion();
}

export function subscribeToInterfaceVersion(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(versionChangeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(versionChangeEvent, callback);
  };
}

export function applyInterfaceVersion(version: InterfaceVersion) {
  document.documentElement.dataset.interfaceVersion = version;
  window.sessionStorage.removeItem(previewStorageKey);
  window.localStorage.setItem(versionStorageKey, version);
  window.dispatchEvent(new Event(versionChangeEvent));
}

export function previewInterfaceVersion(version: InterfaceVersion) {
  document.documentElement.dataset.interfaceVersion = version;
  window.sessionStorage.setItem(previewStorageKey, version);
  window.dispatchEvent(new Event(versionChangeEvent));
}

export function clearInterfaceVersionPreview() {
  window.sessionStorage.removeItem(previewStorageKey);
  window.dispatchEvent(new Event(versionChangeEvent));
}

export function clearStoredInterfaceVersion() {
  window.localStorage.removeItem(versionStorageKey);
}
