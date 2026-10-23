export type FloatingPosition = { x: number; y: number };

export function parseFloatingPosition(value: unknown, fallback: FloatingPosition): FloatingPosition {
  if (typeof value !== "object" || value === null) return fallback;
  const position = value as { x?: unknown; y?: unknown };
  return typeof position.x === "number" && Number.isFinite(position.x) && typeof position.y === "number" && Number.isFinite(position.y)
    ? { x: position.x, y: position.y }
    : fallback;
}
