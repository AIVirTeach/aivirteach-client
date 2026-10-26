import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { handleSiteThemeSave } from "./site-theme-writer";

it("saves a validated, tracked theme JSON through the local endpoint", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "aivirteach-theme-"));
  await mkdir(join(temporaryRoot, "app", "lib"), { recursive: true });
  const server = createServer((request, response) => {
    void handleSiteThemeSave(request, response, temporaryRoot);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server has no port");
    const origin = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${origin}/__dev/ui-customization`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json", "X-Aivirteach-Theme-Editor": "save" },
      body: JSON.stringify({ interfaceVersion: "soft", theme: "dark", learningPathButtonBackground: "#123456", learningPathButtonShadow: false, buttonHeight: 999 }),
    });
    expect(response.status).toBe(200);
    const saved = JSON.parse(await readFile(join(temporaryRoot, "app", "lib", "site-ui-customization.json"), "utf8"));
    expect(saved).toMatchObject({ interfaceVersion: "soft", theme: "dark", learningPathButtonBackground: "#123456", learningPathButtonShadow: false, buttonHeight: 72 });

    const rejected = await fetch(`${origin}/__dev/ui-customization`, {
      method: "POST",
      headers: { Origin: "https://another-site.example", "Content-Type": "application/json", "X-Aivirteach-Theme-Editor": "save" },
      body: "{}",
    });
    expect(rejected.status).toBe(403);
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
    if (resolve(temporaryRoot).startsWith(resolve(tmpdir(), "aivirteach-theme-"))) {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }
});
