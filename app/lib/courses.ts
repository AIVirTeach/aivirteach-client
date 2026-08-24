export type DemoCourse = {
  id: string;
  title: string;
  category: string;
  description: string;
  level: string;
  lessons: number;
  tone: "blue" | "violet" | "cyan" | "indigo";
  coverAssetId?: string;
  localOnly?: boolean;
};

export const activeCourseStorageKey = "aivirteach.activeCourse.v1";

export const courseCatalog: DemoCourse[] = [
  {
    id: "ai-daily-briefing",
    title: "Build an AI Daily Briefing with n8n",
    category: "AI Automation",
    description: "Collect, rank, summarize, and email the most important AI and technology news.",
    level: "Intermediate",
    lessons: 12,
    tone: "blue",
  },
  {
    id: "ai-web-watcher-agent",
    title: "Build an AI Web Watcher Agent with n8n",
    category: "AI Automation",
    description: "Monitor a public webpage, detect meaningful changes, and send relevant alerts.",
    level: "Intermediate",
    lessons: 11,
    tone: "indigo",
  },
  {
    id: "python-basics-browser-lab",
    title: "Python Basics: Browser Lab",
    category: "Python Programming",
    description: "Learn syntax, variables, decisions, and functions in four short browser-based lessons.",
    level: "Beginner",
    lessons: 4,
    tone: "cyan",
    localOnly: true,
  },
];

export const mockPythonCourse = courseCatalog.find((course) => course.localOnly)!;

export function activateCourse(courseId: string) {
  window.localStorage.setItem(activeCourseStorageKey, courseId);
}

export function clearActiveCourse(courseId?: string) {
  window.localStorage.removeItem(activeCourseStorageKey);
  if (courseId) {
    window.localStorage.removeItem(`aivirteach.course.lesson.${courseId}`);
    window.localStorage.removeItem(`aivirteach.lab.activeSeconds.${courseId}`);
  }
}

export function readActiveCourse() {
  const courseId = window.localStorage.getItem(activeCourseStorageKey);
  return courseCatalog.find((course) => course.id === courseId) ?? null;
}
