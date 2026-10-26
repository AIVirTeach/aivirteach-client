// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("./workspace-v2", () => ({ WorkspaceV2: () => <main>Learning Lab V2</main> }));

import WorkspacePage from "./page";

it("opens Learning Lab V2 even with a saved V1 interface preference", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.setItem("aivir-interface-version", "v1");
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () => root.render(<WorkspacePage />));
    expect(host.textContent).toBe("Learning Lab V2");
  } finally {
    await act(async () => root.unmount());
    localStorage.clear();
    vi.unstubAllGlobals();
  }
});
