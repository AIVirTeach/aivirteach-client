"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { getServerInterfaceVersion, getStoredInterfaceVersion, subscribeToInterfaceVersion } from "../lib/interface-version";

export function InterfaceVersionPreference() {
  const interfaceVersion = useSyncExternalStore(subscribeToInterfaceVersion, getStoredInterfaceVersion, getServerInterfaceVersion);

  useLayoutEffect(() => {
    document.documentElement.dataset.interfaceVersion = interfaceVersion;
  }, [interfaceVersion]);

  return null;
}
