import committedSettings from "./site-ui-customization.json";
import { getStoredUiCustomization, sanitizeUiCustomization, type UiCustomization } from "./ui-customization";
import type { InterfaceVersion } from "./interface-version";
import type { Theme } from "./theme";

const hasCommittedSettings = Object.keys(committedSettings).length > 0;

export function getSavedUiCustomization(): UiCustomization | null {
  if (hasCommittedSettings) return sanitizeUiCustomization(committedSettings as Partial<UiCustomization>);
  return getStoredUiCustomization();
}

export function getCommittedInterfaceVersion(): InterfaceVersion {
  const value = (committedSettings as { interfaceVersion?: string }).interfaceVersion;
  return value === "v1" || value === "v2" || value === "soft" || value === "soft-brutal" || value === "brutal" || value === "neubrutal" ? value : "neubrutal";
}

export function getCommittedTheme(): Theme {
  return (committedSettings as { theme?: string }).theme === "dark" ? "dark" : "light";
}
