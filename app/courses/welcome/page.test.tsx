// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ enrollments: vi.fn(), course: vi.fn(), courseWelcome: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks }));
vi.mock("../../lib/api", async (original) => ({ ...await original<typeof import("../../lib/api")>(), api: mocks }));
vi.mock("../../lib/courses", () => ({ activateCourse: vi.fn() }));
vi.mock("../../lib/language", () => ({ useLearningLanguage: () => "en", localize: (_: string, en: string) => en }));
import Page from "./page";
import { ApiError } from "../../lib/api";

let host: HTMLDivElement;
let root: Root;
const course = { id: "acceptance", title: "Acceptance course", description: "Course description", requirements: ["Read the lesson"], outcomes: ["Learn the basics"], category: "Test" };
const emptyWelcome = { overviewAssetId: null, overviewHeading: null, overviewParagraphs: [], howItWorksSteps: null, finalOutcome: null };
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  mocks.enrollments.mockResolvedValue([{ active: true, courseId: course.id }]);
  mocks.course.mockResolvedValue(course);
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it("renders the server welcome response and lets the learner enter the workspace", async () => {
  mocks.courseWelcome.mockResolvedValue({ ...emptyWelcome, overviewHeading: "Published welcome", overviewParagraphs: ["Published introduction"], howItWorksSteps: [{ number: "01", title: "First step", description: "Read carefully" }], finalOutcome: "Published outcome" });
  await act(async () => root.render(<Page />));
  expect(host.textContent).toContain("Published welcome");
  expect(host.textContent).toContain("Published introduction");
  expect(host.textContent).toContain("First step");
  expect(host.textContent).toContain("Published outcome");
  await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Next")!.click());
  await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Let's go")!.click());
  expect(mocks.push).toHaveBeenCalledWith("/workspace");
});
it("uses course metadata for a newly created empty welcome row", async () => {
  mocks.courseWelcome.mockResolvedValue(emptyWelcome);
  await act(async () => root.render(<Page />));
  expect(host.textContent).toContain(course.title);
  expect(host.textContent).toContain(course.description);
  expect(host.textContent).toContain("Read the lesson");
});
it("keeps the missing welcome fallback", async () => {
  mocks.courseWelcome.mockRejectedValue(new ApiError(404, "not found"));
  await act(async () => root.render(<Page />));
  expect(host.textContent).toContain(course.title);
});
it("reports request failure without crashing", async () => {
  mocks.courseWelcome.mockRejectedValue(new ApiError(503, "Service unavailable"));
  await act(async () => root.render(<Page />));
  expect(host.textContent).toContain("Service unavailable");
});
it("shows an error for invalid stored steps rather than crashing during rendering", async () => {
  mocks.courseWelcome.mockResolvedValue({ ...emptyWelcome, howItWorksSteps: [{ title: 42 }] });
  await act(async () => root.render(<Page />));
  expect(host.textContent).toContain("Invalid course welcome steps.");
});
it("renders the asset from the server asset id", async () => {
  mocks.courseWelcome.mockResolvedValue({ ...emptyWelcome, overviewAssetId: "welcome-image" });
  await act(async () => root.render(<Page />));
  expect(host.querySelector("img")?.getAttribute("src")).toContain("/courses/acceptance/assets/welcome-image");
});
it("shows the course picker when there is no active enrollment", async () => {
  mocks.enrollments.mockResolvedValue([]);
  await act(async () => root.render(<Page />));
  expect(host.textContent).toContain("No active course");
  expect(mocks.courseWelcome).not.toHaveBeenCalled();
});
