import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const workspaceRoot = path.resolve(process.cwd(), "..");
const courseDataRoot = path.join(workspaceRoot, "course data");
const catalogPath = path.join(courseDataRoot, "catalog.json");
const outputPath = path.join(process.cwd(), "app", "lib", "generated-admin-courses.json");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

const catalog = await readJson(catalogPath);
const courses = [];

for (const catalogEntry of catalog.courses) {
  const manifestPath = path.join(courseDataRoot, ...catalogEntry.manifest.split("/"));
  const courseFolder = path.dirname(manifestPath);
  const manifest = await readJson(manifestPath);
  const welcome = await readJson(path.join(courseFolder, manifest.welcome.path));
  const assessmentDocument = await readJson(path.join(courseFolder, manifest.assessments.path));
  const sourceText = await readFile(path.join(courseFolder, manifest.source.path), manifest.source.encoding ?? "utf8");
  const sourceLines = sourceText.split(/\r?\n/);

  courses.push({
    schemaVersion: manifest.schemaVersion,
    id: manifest.id,
    slug: manifest.slug,
    version: manifest.version,
    status: manifest.status,
    visibility: catalogEntry.published ? "public" : "hidden",
    metadata: manifest.metadata,
    outcomes: manifest.outcomes,
    requirements: manifest.requirements,
    source: manifest.source,
    assets: manifest.assets,
    welcome,
    modules: manifest.modules.map((module) => ({
      ...module,
      lessons: module.lessons.map((lesson) => ({
        ...lesson,
        content: sourceLines.slice(lesson.sourceRange.startLine - 1, lesson.sourceRange.endLine).join("\n").trim(),
      })),
    })),
    assessments: assessmentDocument.assessments,
  });
}

await writeFile(outputPath, `${JSON.stringify(courses, null, 2)}\n`, "utf8");
console.log(`Synced ${courses.length} courses from ${catalogPath}`);
