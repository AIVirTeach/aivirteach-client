import assert from "node:assert/strict";
import test from "node:test";
import { createDesktopConfig, validateDesktopAppUrl } from "../scripts/create-desktop-config.mjs";

test("normalizes a production HTTPS frontend URL into a Tauri override", () => {
  const appUrl = validateDesktopAppUrl("https://learn.example.com");
  assert.equal(appUrl, "https://learn.example.com/");
  assert.deepEqual(createDesktopConfig(appUrl), {
    $schema: "https://schema.tauri.app/config/2",
    build: { frontendDist: "https://learn.example.com/" },
  });
});

test("rejects unsafe desktop target URLs", () => {
  for (const value of [
    "",
    " learn.example.com ",
    "http://learn.example.com/",
    "javascript:alert(1)",
    "https://user:secret@learn.example.com/",
    "https://learn.example.com/?token=secret",
    "https://learn.example.com/#workspace",
  ]) {
    assert.throws(() => validateDesktopAppUrl(value));
  }
});

test("allows HTTP only for an explicitly enabled loopback test", () => {
  assert.equal(
    validateDesktopAppUrl("http://localhost:3001/", { allowHttpLocalhost: true }),
    "http://localhost:3001/",
  );
  assert.throws(() => validateDesktopAppUrl("http://127.0.0.1:3001/"));
  assert.throws(() => validateDesktopAppUrl("http://192.168.1.20:3001/", { allowHttpLocalhost: true }));
});
