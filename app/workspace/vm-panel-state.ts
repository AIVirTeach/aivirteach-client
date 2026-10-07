import type { ApiWorkspace } from "../lib/api";

export type VmPanelState = "console" | "start-console" | "stopped" | "error" | "preparing";

// STOPPED 必须单独成一档：之前它落进 "preparing"，页面一直显示"正在准备"，没有任何办法重新启动。
export function vmPanelState(status: ApiWorkspace["status"] | undefined, consoleReady: boolean): VmPanelState {
  if (status === "RUNNING") return consoleReady ? "console" : "start-console";
  if (status === "STOPPED") return "stopped";
  if (status === "ERROR") return "error";
  return "preparing";
}
