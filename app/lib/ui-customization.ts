export type UiCustomization = {
  accentColor: string;
  menuItemHover: string;
  buttonBackground: string;
  buttonText: string;
  buttonHeight: number;
  buttonFontSize: number;
  buttonRadius: number;
  fieldBackground: string;
  fieldText: string;
  fieldBorder: string;
  focusBorder: string;
  fieldHeight: number;
  fieldFontSize: number;
  fieldRadius: number;
  cardBackground: string;
  cardBorder: string;
  cardRadius: number;
  cardPadding: number;
};

export const defaultUiCustomization: UiCustomization = {
  accentColor: "#2563eb",
  menuItemHover: "#d1d5db",
  buttonBackground: "#000000",
  buttonText: "#ffffff",
  buttonHeight: 42,
  buttonFontSize: 14,
  buttonRadius: 0,
  fieldBackground: "#ffffff",
  fieldText: "#000000",
  fieldBorder: "#000000",
  focusBorder: "#93c5fd",
  fieldHeight: 54,
  fieldFontSize: 16,
  fieldRadius: 0,
  cardBackground: "#ffffff",
  cardBorder: "#000000",
  cardRadius: 0,
  cardPadding: 24,
};

const storageKey = "aivirteach-ui-customization";
const changeEvent = "aivirteach:ui-customization-change";
const colorPattern = /^#[0-9a-f]{6}$/i;
const numberRanges: Record<keyof Pick<UiCustomization, "buttonHeight" | "buttonFontSize" | "buttonRadius" | "fieldHeight" | "fieldFontSize" | "fieldRadius" | "cardRadius" | "cardPadding">, [number, number]> = {
  buttonHeight: [28, 72],
  buttonFontSize: [11, 22],
  buttonRadius: [0, 32],
  fieldHeight: [36, 76],
  fieldFontSize: [12, 22],
  fieldRadius: [0, 32],
  cardRadius: [0, 32],
  cardPadding: [8, 48],
};

function sanitize(candidate: Partial<UiCustomization>): UiCustomization {
  const next = { ...defaultUiCustomization };
  for (const key of ["accentColor", "menuItemHover", "buttonBackground", "buttonText", "fieldBackground", "fieldText", "fieldBorder", "focusBorder", "cardBackground", "cardBorder"] as const) {
    if (typeof candidate[key] === "string" && colorPattern.test(candidate[key])) next[key] = candidate[key];
  }
  for (const key of Object.keys(numberRanges) as (keyof typeof numberRanges)[]) {
    const value = Number(candidate[key]);
    const [minimum, maximum] = numberRanges[key];
    if (Number.isFinite(value)) next[key] = Math.min(maximum, Math.max(minimum, Math.round(value)));
  }
  return next;
}

export function getStoredUiCustomization(): UiCustomization | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return null;
  try {
    return sanitize(JSON.parse(stored) as Partial<UiCustomization>);
  } catch {
    return null;
  }
}

const cssVariables: Record<keyof UiCustomization, string> = {
  accentColor: "--ui-accent",
  menuItemHover: "--ui-menu-item-hover",
  buttonBackground: "--ui-button-bg",
  buttonText: "--ui-button-text",
  buttonHeight: "--ui-button-height",
  buttonFontSize: "--ui-button-font-size",
  buttonRadius: "--ui-button-radius",
  fieldBackground: "--ui-field-bg",
  fieldText: "--ui-field-text",
  fieldBorder: "--ui-field-border",
  focusBorder: "--ui-focus-border",
  fieldHeight: "--ui-field-height",
  fieldFontSize: "--ui-field-font-size",
  fieldRadius: "--ui-field-radius",
  cardBackground: "--ui-card-bg",
  cardBorder: "--ui-card-border",
  cardRadius: "--ui-card-radius",
  cardPadding: "--ui-card-padding",
};

const pixelValues = new Set<keyof UiCustomization>(["buttonHeight", "buttonFontSize", "buttonRadius", "fieldHeight", "fieldFontSize", "fieldRadius", "cardRadius", "cardPadding"]);

export function previewUiCustomization(settings: UiCustomization) {
  const root = document.documentElement;
  root.dataset.uiCustomized = "true";
  const safe = sanitize(settings);
  for (const key of Object.keys(cssVariables) as (keyof UiCustomization)[]) {
    root.style.setProperty(cssVariables[key], `${safe[key]}${pixelValues.has(key) ? "px" : ""}`);
  }
  root.style.setProperty("--primary", safe.accentColor);
  root.style.setProperty("--ring", safe.focusBorder);
}

export function saveUiCustomization(settings: UiCustomization) {
  const safe = sanitize(settings);
  previewUiCustomization(safe);
  window.localStorage.setItem(storageKey, JSON.stringify(safe));
  window.dispatchEvent(new Event(changeEvent));
}

export function removeUiCustomizationPreview() {
  const root = document.documentElement;
  delete root.dataset.uiCustomized;
  for (const variable of Object.values(cssVariables)) root.style.removeProperty(variable);
  root.style.removeProperty("--primary");
  root.style.removeProperty("--ring");
}

export function clearUiCustomization() {
  removeUiCustomizationPreview();
  window.localStorage.removeItem(storageKey);
  window.dispatchEvent(new Event(changeEvent));
}

export function subscribeToUiCustomization(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(changeEvent, callback);
  };
}
