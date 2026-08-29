import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGuacamolePublicPath, validateLabEmbedUrl } from "../app/lib/lab-session.ts";

test("accepts one opaque same-origin Guacamole ticket", () => {
  const value = "/guacamole/?data=opaque%2Bticket%3D";
  assert.equal(validateLabEmbedUrl(value), value);
});

test("supports an explicitly configured same-origin Guacamole path", () => {
  assert.equal(normalizeGuacamolePublicPath("/remote-lab"), "/remote-lab/");
  assert.equal(
    validateLabEmbedUrl("/remote-lab/?data=ticket", "/remote-lab"),
    "/remote-lab/?data=ticket",
  );
  assert.throws(
    () => validateLabEmbedUrl("/guacamole/?data=ticket", "/remote-lab"),
    /invalid browser connection URL/,
  );
  assert.throws(() => normalizeGuacamolePublicPath("/"));
  assert.throws(() => normalizeGuacamolePublicPath("https://evil.example/guacamole/"));
});

test("rejects browser-session URLs outside the Guacamole proxy contract", () => {
  for (const value of [
    "https://guacamole.example.com/guacamole/?data=ticket",
    "//guacamole.example.com/guacamole/?data=ticket",
    "/guacamole/../login?data=ticket",
    "/guacamole/?data=ticket&next=https://evil.example",
    "/guacamole/?data=",
    "/guacamole/?data=ticket#fragment",
    " /guacamole/?data=ticket",
  ]) {
    assert.throws(() => validateLabEmbedUrl(value), /invalid browser connection URL/);
  }
});
