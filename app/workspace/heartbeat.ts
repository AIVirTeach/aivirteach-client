export const heartbeatIntervalMs = 60_000;

export function isHeartbeatDue(status: string | undefined, isVisible: boolean, isFocused: boolean): boolean {
  return status === "RUNNING" && isVisible && isFocused;
}
