import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker from "../dist/server/index.js";

const config = JSON.parse(await readFile(new URL("../dist/server/wrangler.json", import.meta.url)));
assert.equal(config.name, "aivir-client-pr");
assert.equal(config.account_id, "1a8f2715631a9ec907b67f41239938ad");
assert.equal(config.assets.binding, "ASSETS");
assert.equal(config.images.binding, "IMAGES");
const response = await worker.fetch(
  new Request("https://aivir-client-pr.aivirteach.workers.dev/preview/lesson", {
    headers: { accept: "text/html" },
  }),
  { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
  { waitUntil() {}, passThroughOnException() {} },
);
assert.equal(response.status, 200);
assert.equal(response.headers.get("content-security-policy"),
  "frame-ancestors https://aivirteach-admin.vercel.app");
assert.equal(response.headers.get("cache-control"), "no-store");
assert.match(await response.text(), /https:\/\/aivirteach-admin\.vercel\.app/);
console.log("Cloudflare artifact verified: worker, bindings, preview CSP and message origin.");
