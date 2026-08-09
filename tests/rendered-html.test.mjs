import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);

async function request(path) {
  const url = new URL(workerUrl);
  url.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(url.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

for (const [path, expected] of [
  ["/login", "Turn AI Learners into AI Builders"],
  ["/dashboard", "Build an Agent using n8n"],
  ["/analysis", "Learning Analytics"],
  ["/courses", "Choose what to learn next"],
  ["/courses/welcome", "Preparing your course"],
  ["/workspace", "Opening Learning Lab"],
]) {
  test(`renders ${path}`, async () => {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.match(await response.text(), new RegExp(expected));
  });
}

test("does not expose the retired frontend mock profile API", async () => {
  const response = await request("/api/mock/profile");
  assert.equal(response.status, 404);
});
