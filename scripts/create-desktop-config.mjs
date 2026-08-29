import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutputPath = resolve(repositoryRoot, "src-tauri/tauri.generated.conf.json");
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function validateDesktopAppUrl(rawValue, { allowHttpLocalhost = false } = {}) {
  if (typeof rawValue !== "string" || rawValue.length === 0 || rawValue !== rawValue.trim()) {
    throw new Error("AIVIRTEACH_DESKTOP_APP_URL must be a non-empty URL without surrounding whitespace.");
  }

  let target;
  try {
    target = new URL(rawValue);
  } catch {
    throw new Error("AIVIRTEACH_DESKTOP_APP_URL must be an absolute URL.");
  }

  const isHttps = target.protocol === "https:";
  const isExplicitLocalTest = allowHttpLocalhost
    && target.protocol === "http:"
    && loopbackHosts.has(target.hostname);

  if (!isHttps && !isExplicitLocalTest) {
    throw new Error("AIVIRTEACH_DESKTOP_APP_URL must use HTTPS. HTTP is allowed only for an explicitly enabled localhost test.");
  }
  if (target.username || target.password) {
    throw new Error("AIVIRTEACH_DESKTOP_APP_URL must not contain credentials.");
  }
  if (target.search || target.hash) {
    throw new Error("AIVIRTEACH_DESKTOP_APP_URL must not contain a query string or fragment.");
  }

  return target.toString();
}

export function createDesktopConfig(appUrl) {
  return {
    $schema: "https://schema.tauri.app/config/2",
    build: {
      frontendDist: appUrl,
    },
  };
}

export async function writeDesktopConfig({ outputPath = defaultOutputPath } = {}) {
  const appUrl = validateDesktopAppUrl(process.env.AIVIRTEACH_DESKTOP_APP_URL, {
    allowHttpLocalhost: process.env.AIVIRTEACH_DESKTOP_ALLOW_HTTP_LOCALHOST === "1",
  });
  const config = createDesktopConfig(appUrl);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  return { appUrl, outputPath };
}

async function main() {
  try {
    const result = await writeDesktopConfig();
    console.log(`Desktop target: ${result.appUrl}`);
    console.log(`Generated: ${result.outputPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) await main();
