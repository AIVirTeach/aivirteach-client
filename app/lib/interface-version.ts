export type InterfaceVersion = "v1" | "v2" | "soft" | "brutal" | "neubrutal";

const versionStorageKey = "aivir-interface-version";
const versionChangeEvent = "aivirteach:interface-version-change";

export function getStoredInterfaceVersion(): InterfaceVersion {
  const storedVersion = window.localStorage.getItem(versionStorageKey);
  return storedVersion === "v1" || storedVersion === "soft" || storedVersion === "brutal" || storedVersion === "neubrutal" ? storedVersion : "v2";
}

export function getServerInterfaceVersion(): InterfaceVersion {
  return "v2";
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
  window.localStorage.setItem(versionStorageKey, version);
  window.dispatchEvent(new Event(versionChangeEvent));
}
