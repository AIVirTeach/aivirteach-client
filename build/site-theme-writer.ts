import { writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { sanitizeUiCustomization } from "../app/lib/ui-customization";

export async function handleSiteThemeSave(request: IncomingMessage, response: ServerResponse, root: string) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (request.method !== "POST") {
    response.writeHead(405).end(JSON.stringify({ error: "Use POST to save a theme." }));
    return;
  }

  const origin = request.headers.origin;
  const host = request.headers.host;
  let sameOrigin = false;
  try {
    sameOrigin = Boolean(origin && host && new URL(origin).host === host);
  } catch {
    // Malformed origins are rejected along with cross-origin requests.
  }
  if (request.headers["x-aivirteach-theme-editor"] !== "save" ||
      !request.headers["content-type"]?.startsWith("application/json") || !sameOrigin) {
    response.writeHead(403).end(JSON.stringify({ error: "Theme saves must come from this local site." }));
    return;
  }

  try {
    let body = "";
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 32_768) {
        response.writeHead(413).end(JSON.stringify({ error: "Theme settings are too large." }));
        return;
      }
    }
    const candidate: unknown = JSON.parse(body);
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      response.writeHead(400).end(JSON.stringify({ error: "Invalid theme settings." }));
      return;
    }
    const settings = sanitizeUiCustomization(candidate);
    const selected = candidate as Record<string, unknown>;
    const interfaceVersion = selected.interfaceVersion;
    const theme = selected.theme;
    if (!(interfaceVersion === "v1" || interfaceVersion === "v2" || interfaceVersion === "soft" || interfaceVersion === "soft-brutal" || interfaceVersion === "brutal" || interfaceVersion === "neubrutal") ||
        !(theme === "light" || theme === "dark")) {
      response.writeHead(400).end(JSON.stringify({ error: "Invalid visual style or theme mode." }));
      return;
    }
    const saved = { interfaceVersion, theme, ...settings };
    await writeFile(resolve(root, "app", "lib", "site-ui-customization.json"), `${JSON.stringify(saved, null, 2)}\n`, "utf8");
    response.writeHead(200).end(JSON.stringify(saved));
  } catch {
    response.writeHead(400).end(JSON.stringify({ error: "Could not save theme settings." }));
  }
}

export function siteThemeWriter(): Plugin {
  let root = process.cwd();

  return {
    name: "site-theme-writer",
    apply: "serve",
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use("/__dev/ui-customization", (request, response) => {
        void handleSiteThemeSave(request, response, root);
      });
    },
  };
}
