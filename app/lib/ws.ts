import { API_BASE_URL } from "./config";
import { getAccessToken, type ApiWorkspace } from "./api";

type WorkspaceStatusMessage = { type: "workspace.status"; workspace: ApiWorkspace };

export function subscribeWorkspace(enrollmentId: string, onStatus: (workspace: ApiWorkspace) => void): () => void {
  const url = new URL(API_BASE_URL.replace(/^http/, "ws") + "/workspaces/socket");
  const token = getAccessToken();
  if (token) url.searchParams.set("token", token);
  url.searchParams.set("enrollmentId", enrollmentId);

  const socket = new WebSocket(url.toString());
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data as string) as WorkspaceStatusMessage;
      if (message.type === "workspace.status") onStatus(message.workspace);
    } catch {
      // 忽略解析不了的消息
    }
  };

  return () => socket.close();
}
