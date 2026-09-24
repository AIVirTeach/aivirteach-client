import { copyFileSync, createReadStream, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const route = "/courses/new_design";
const course = { id: "ai-daily-briefing", title: "AI Daily Briefing" } as const;
const designsDirectory = fileURLToPath(new URL("../../course data/new_designs/", import.meta.url));
const logoPath = fileURLToPath(new URL("../../design/logo only.png", import.meta.url));
const publicLogoPath = fileURLToPath(new URL("../public/logo-only.png", import.meta.url));

function listThemes() {
  return readdirSync(designsDirectory)
    .filter((fileName) => fileName.startsWith("ai-daily-briefing-") && fileName.toLowerCase().endsWith(".html"))
    .sort()
    .map((fileName) => {
      const id = fileName.slice(0, -5);
      const style = id.replace(/^ai-daily-briefing-v3-/, "").replace(/-style$/, "");
      const label = style.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
      return { id, label, url: `${route}/${encodeURIComponent(id)}` };
    });
}

export function localCourseDesigns(): Plugin {
  return {
    name: "aivirteach-local-course-designs",
    configResolved() {
      copyFileSync(logoPath, publicLogoPath);
    },
    configureServer(server) {
      server.watcher.add(logoPath);
      server.watcher.on("change", (changedPath) => {
        if (resolve(changedPath) === resolve(logoPath)) server.ws.send({ type: "full-reload", path: "*" });
      });

      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

        if (pathname === "/logo-only.png") {
          response.statusCode = 200;
          response.setHeader("Content-Type", "image/png");
          response.setHeader("Cache-Control", "no-store");
          createReadStream(logoPath).pipe(response);
          return;
        }

        if (pathname === route) {
          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.end(JSON.stringify({ course, themes: listThemes() }));
          return;
        }

        if (!pathname.startsWith(`${route}/`)) {
          next();
          return;
        }

        const id = decodeURIComponent(pathname.slice(route.length + 1));
        if (!/^[a-z0-9-]+$/i.test(id)) {
          response.statusCode = 400;
          response.end("Invalid course design id");
          return;
        }

        const filePath = resolve(designsDirectory, `${id}.html`);
        if (!existsSync(filePath)) {
          response.statusCode = 404;
          response.end("Course design not found");
          return;
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        createReadStream(filePath).pipe(response);
      });
    },
  };
}
